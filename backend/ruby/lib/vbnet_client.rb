require 'json'
require 'open3'

class VBNetClient
  # Path to ApiServer.exe (relative to project root)
  API_SERVER_PATH = File.join(__dir__, '..', '..', '..', 'VBNET', 'ApiServer', 'bin', 'Debug', 'net8.0', 'ApiServer.exe')

  def self.compile_flow(nodes, edges, tasks, ddts)
    command = {
      command: 'compile-flow',
      data: {
        nodes: nodes,
        edges: edges,
        tasks: tasks,
        ddts: ddts || []
      }
    }

    execute_command(command)
  end

  def self.compile_ddt(ddt_json)
    command = {
      command: 'compile-ddt',
      data: {
        ddtJson: ddt_json
      }
    }

    execute_command(command)
  end

  def self.run_ddt(ddt_instance, user_inputs, translations, limits)
    command = {
      command: 'run-ddt',
      data: {
        ddt_instance: ddt_instance,
        user_inputs: user_inputs || [],
        translations: translations || {},
        limits: limits || {}
      }
    }

    execute_command(command)
  end

  private

  def self.execute_command(command)
    json_input = command.to_json

    unless File.exist?(API_SERVER_PATH)
      raise "ApiServer.exe not found at: #{API_SERVER_PATH}"
    end

    stdout, stderr, status = Open3.capture3(API_SERVER_PATH, stdin_data: json_input)

    unless status.success?
      raise "ApiServer.exe failed: #{stderr}"
    end

    begin
      response = JSON.parse(stdout)
      if response['success']
        response['data']
      else
        error_msg = response['error'] || 'Unknown error'
        stack_trace = response['stackTrace']
        raise "VB.NET API error: #{error_msg}#{stack_trace ? "\n#{stack_trace}" : ''}"
      end
    rescue JSON::ParserError => e
      raise "Failed to parse ApiServer response: #{e.message}\nResponse: #{stdout}"
    end
  end
end

