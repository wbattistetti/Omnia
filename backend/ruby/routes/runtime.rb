require 'sinatra/base'

class RuntimeRoutes < Sinatra::Base
  # Enable CORS for all routes
  before do
    headers 'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization'
  end

  options '*' do
    200
  end

  post '/api/runtime/compile' do
    content_type :json

    begin
      puts "[RUBY] POST /api/runtime/compile - Request received"
      request_data = JSON.parse(request.body.read)
      puts "[RUBY] Request parsed successfully"

      # ✅ Translations come from frontend (already in memory from ProjectTranslationsContext)
      # Frontend passes translations table directly - no database access needed
      # Runtime will do lookup at execution time instead of "baking" translations during compilation
      translations = request_data['translations'] || {}
      puts "[RUBY] Calling VBNetClient.compile_flow..."

      result = VBNetClient.compile_flow(
        request_data['nodes'],
        request_data['edges'],
        request_data['tasks'],
        request_data['ddts'],
        translations # ✅ Pass translations to VB.NET compiler (already in memory from frontend)
      )

      puts "[RUBY] VBNetClient.compile_flow completed successfully"

      {
        taskGroups: result['taskGroups'],
        taskGroupMap: result['taskGroupMap'],
        entryTaskGroupId: result['entryTaskGroupId'],
        tasks: result['tasks'],
        taskMap: result['taskMap'],
        translations: result['translations'] || {}, # ✅ Include translation table for runtime lookup
        compiledBy: 'VB.NET_RUNTIME',
        timestamp: Time.now.iso8601
      }.to_json
    rescue => e
      puts "[RUBY] ❌ Error in /api/runtime/compile:"
      puts "[RUBY]    #{e.class}: #{e.message}"
      puts "[RUBY]    Backtrace:"
      e.backtrace.first(10).each { |line| puts "[RUBY]      #{line}" }

      status 500
      {
        error: 'Compilation failed',
        message: e.message,
        stack: e.backtrace.join("\n")
      }.to_json
    end
  end

  post '/api/runtime/compile/task' do
    content_type :json

    begin
      puts "[RUBY] POST /api/runtime/compile/task - Request received"
      request_data = JSON.parse(request.body.read)
      puts "[RUBY] Request parsed successfully"

      # Forward to VB.NET API
      result = VBNetClient.compile_task(
        request_data['task'],
        request_data['ddts'] || [],
        request_data['translations'] || {}
      )

      puts "[RUBY] VBNetClient.compile_task completed successfully"

      result.to_json
    rescue => e
      puts "[RUBY] ❌ Error in /api/runtime/compile/task:"
      puts "[RUBY]    #{e.class}: #{e.message}"
      puts "[RUBY]    Backtrace:"
      e.backtrace.first(10).each { |line| puts "[RUBY]      #{line}" }

      status 500
      {
        error: 'Task compilation failed',
        message: e.message,
        stack: e.backtrace.join("\n")
      }.to_json
    end
  end

  post '/api/runtime/ddt/run' do
    content_type :json

    begin
      request_data = JSON.parse(request.body.read)

      result = VBNetClient.run_ddt(
        request_data['ddtInstance'],
        request_data['userInputs'] || [],
        request_data['translations'] || {},
        request_data['limits'] || {}
      )

      {
        success: result['success'],
        value: result['value'],
        messages: result['messages'] || [],
        executedBy: 'VB.NET_RUNTIME',
        timestamp: Time.now.iso8601
      }.to_json
    rescue => e
      status 500
      {
        error: 'DDT execution failed',
        message: e.message,
        stack: e.backtrace.join("\n")
      }.to_json
    end
  end

  post '/api/runtime/ddt/session/start' do
    content_type :json

    begin
      puts "[RUBY] POST /api/runtime/ddt/session/start - Request received"
      request_data = JSON.parse(request.body.read)

      ddt_instance = request_data['ddtInstance']
      translations = request_data['translations'] || {}
      limits = request_data['limits'] || {}

      # ✅ DEBUG: Verifica ddt_instance ricevuto dal frontend
      puts "═══════════════════════════════════════════════════════════════════════════"
      puts "🔍 [RUBY] DEBUG: Analyzing ddt_instance from frontend"
      puts "═══════════════════════════════════════════════════════════════════════════"
      puts "[RUBY] ddt_instance.nil?=#{ddt_instance.nil?}"
      unless ddt_instance.nil?
        puts "[RUBY] ddt_instance['id']=#{ddt_instance['id']}"
        puts "[RUBY] ddt_instance['label']=#{ddt_instance['label']}"
      puts "[RUBY] ddt_instance['data'].nil?=#{ddt_instance['data'].nil?}"
      unless ddt_instance['data'].nil?
        data = ddt_instance['data']
        if data.is_a?(Array)
          puts "[RUBY] ddt_instance['data'].is_a?(Array)=true, count=#{data.length}"
          if data.length > 0
            first_data = data[0]
            puts "[RUBY] First data: id=#{first_data['id']}, name=#{first_data['name']}"
            puts "[RUBY] First data['steps'].nil?=#{first_data['steps'].nil?}"
            unless first_data['steps'].nil?
              puts "[RUBY] First data['steps'].length=#{first_data['steps'].length}"
            end
          else
            puts "[RUBY] ⚠️ WARNING: data array is EMPTY!"
          end
        else
          puts "[RUBY] ⚠️ WARNING: data is NOT an Array, type=#{data.class}"
        end
      else
        puts "[RUBY] ⚠️ WARNING: ddt_instance['data'] is nil!"
      end
        puts "[RUBY] ddt_instance['introduction'].nil?=#{ddt_instance['introduction'].nil?}"
        puts "[RUBY] ddt_instance['translations'].nil?=#{ddt_instance['translations'].nil?}"
      else
        puts "[RUBY] ❌ CRITICAL ERROR: ddt_instance is nil!"
      end
      puts "═══════════════════════════════════════════════════════════════════════════"

      if ddt_instance.nil?
        status 400
        return {
          error: 'Missing ddtInstance',
          message: 'ddtInstance is required'
        }.to_json
      end

      puts "[RUBY] Compiling DDT..."
      # Step 1: Compile DDT (create empty flow with only DDT)
      compilation_result = VBNetClient.compile_flow(
        [], # nodes - empty for single DDT
        [], # edges - empty for single DDT
        [], # tasks - empty for single DDT
        [ddt_instance], # ddts - single DDT
        translations
      )

      puts "[RUBY] DDT compiled successfully, creating orchestrator session..."
      # ✅ DEBUG: Verifica cosa viene inviato a VB.NET
      puts "═══════════════════════════════════════════════════════════════════════════"
      puts "🔍 [RUBY] DEBUG: About to call start_orchestrator_session"
      puts "═══════════════════════════════════════════════════════════════════════════"
      puts "[RUBY] compilation_result.nil?=#{compilation_result.nil?}"
      puts "[RUBY] ddts array length=#{[ddt_instance].length}"
      puts "[RUBY] ddts[0].nil?=#{ddt_instance.nil?}"
      unless ddt_instance.nil?
        puts "[RUBY] ddts[0]['id']=#{ddt_instance['id']}"
        puts "[RUBY] ddts[0]['data'].nil?=#{ddt_instance['data'].nil?}"
      end
      puts "═══════════════════════════════════════════════════════════════════════════"

      # Step 2: Start orchestrator session with compiled DDT
      session_result = VBNetClient.start_orchestrator_session(
        compilation_result,
        [], # tasks - empty for single DDT
        [ddt_instance], # ddts
        translations
      )

      session_id = session_result['sessionId']
      if session_id.nil?
        raise "VB.NET did not return a sessionId"
      end

      puts "[RUBY] ✅ Session created: #{session_id}"

      {
        sessionId: session_id,
        timestamp: Time.now.iso8601
      }.to_json
    rescue => e
      puts "[RUBY] ❌ Error in /api/runtime/ddt/session/start:"
      puts "[RUBY]    #{e.class}: #{e.message}"
      puts "[RUBY]    Backtrace:"
      e.backtrace.first(10).each { |line| puts "[RUBY]      #{line}" }

      status 500
      {
        error: 'Failed to create session',
        message: e.message,
        stack: e.backtrace.join("\n")
      }.to_json
    end
  end

  # Proxy endpoints for DDT session (forward to orchestrator endpoints)
  post '/api/runtime/ddt/session/:id/input' do |session_id|
    content_type :json

    begin
      request_data = JSON.parse(request.body.read)
      input = request_data['input']

      if input.nil?
        status 400
        return {
          error: 'Missing input',
          message: 'input is required'
        }.to_json
      end

      result = VBNetClient.send_orchestrator_input(session_id, input)
      result.to_json
    rescue => e
      puts "[RUBY] ❌ Error in /api/runtime/ddt/session/#{session_id}/input:"
      puts "[RUBY]    #{e.class}: #{e.message}"

      status 500
      {
        error: 'Failed to send input',
        message: e.message
      }.to_json
    end
  end

  get '/api/runtime/ddt/session/:id/stream' do |session_id|
    # SSE streams cannot be redirected easily, so we proxy the request
    # Frontend should ideally use /api/runtime/orchestrator/session/{id}/stream directly
    # But we proxy for backward compatibility
    begin
      uri = URI.parse("http://localhost:5000/api/runtime/orchestrator/session/#{session_id}/stream")

      # Forward SSE stream request to VB.NET ApiServer
      # This is a simple proxy - for production, consider using a proper HTTP proxy library
      content_type 'text/event-stream'
      headers 'Cache-Control' => 'no-cache',
              'Connection' => 'keep-alive',
              'X-Accel-Buffering' => 'no'

      stream(:keep_open) do |out|
        Net::HTTP.start(uri.host, uri.port) do |http|
          request = Net::HTTP::Get.new(uri.path)
          request['Accept'] = 'text/event-stream'

          http.request(request) do |response|
            response.read_body do |chunk|
              out << chunk
            end
          end
        end
      end
    rescue => e
      puts "[RUBY] ❌ Error proxying SSE stream: #{e.message}"
      status 500
      "event: error\ndata: #{JSON.generate({error: e.message})}\n\n"
    end
  end

  delete '/api/runtime/ddt/session/:id' do |session_id|
    content_type :json

    begin
      success = VBNetClient.delete_orchestrator_session(session_id)

      if success
        {
          success: true,
          message: 'Session deleted'
        }.to_json
      else
        status 500
        {
          error: 'Failed to delete session'
        }.to_json
      end
    rescue => e
      puts "[RUBY] ❌ Error in DELETE /api/runtime/ddt/session/#{session_id}:"
      puts "[RUBY]    #{e.class}: #{e.message}"

      status 500
      {
        error: 'Failed to delete session',
        message: e.message
      }.to_json
    end
  end
end

# Include routes in main app
Sinatra::Application.use RuntimeRoutes

