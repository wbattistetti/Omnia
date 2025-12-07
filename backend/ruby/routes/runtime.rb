require 'sinatra/base'

class RuntimeRoutes < Sinatra::Base
  post '/api/runtime/compile' do
    content_type :json

    begin
      request_data = JSON.parse(request.body.read)

      result = VBNetClient.compile_flow(
        request_data['nodes'],
        request_data['edges'],
        request_data['tasks'],
        request_data['ddts']
      )

      {
        taskGroups: result['taskGroups'],
        taskGroupMap: result['taskGroupMap'],
        entryTaskGroupId: result['entryTaskGroupId'],
        tasks: result['tasks'],
        taskMap: result['taskMap'],
        compiledBy: 'VB.NET_RUNTIME',
        timestamp: Time.now.iso8601
      }.to_json
    rescue => e
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

