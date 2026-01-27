require 'sinatra/base'

class RuntimeRoutes < Sinatra::Base
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
      request_data = JSON.parse(request.body.read)

      # TODO: Implement session management
      session_id = SecureRandom.uuid

      {
        sessionId: session_id,
        timestamp: Time.now.iso8601
      }.to_json
    rescue => e
      status 500
      {
        error: 'Failed to create session',
        message: e.message
      }.to_json
    end
  end
end

# Include routes in main app
Sinatra::Application.use RuntimeRoutes

