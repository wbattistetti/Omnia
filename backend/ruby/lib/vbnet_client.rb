require 'json'
require 'net/http'
require 'uri'

class VBNetClient
  # ApiServer HTTP endpoint
  API_SERVER_BASE_URL = 'http://localhost:5000'

  # Compile flow via HTTP API
  def self.compile_flow(nodes, edges, tasks, ddts, translations = {})
    data = {
      nodes: nodes,
      edges: edges,
      tasks: tasks,
      ddts: ddts || [],
      translations: translations || {} # ✅ Translations from frontend (already in memory)
    }

    call_api('/api/runtime/compile', data)
  end

  # Compile single task via HTTP API (for chat simulator)
  def self.compile_task(task, ddts = [], translations = {})
    data = {
      task: task,
      ddts: ddts || [],
      translations: translations || {}
    }

    call_api('/api/runtime/compile/task', data)
  end

  # Compile DDT via HTTP API
  def self.compile_ddt(ddt_json)
    data = {
      ddtJson: ddt_json
    }

    call_api('/api/compile-ddt', data)
  end

  # Run DDT via HTTP API
  def self.run_ddt(ddt_instance, user_inputs, translations, limits)
    data = {
      ddt_instance: ddt_instance,
      user_inputs: user_inputs || [],
      translations: translations || {},
      limits: limits || {}
    }

    call_api('/api/run-ddt', data)
  end

  # Start orchestrator session (for DDT or flow)
  def self.start_orchestrator_session(compilation_result, tasks, ddts, translations)
    # ✅ DEBUG: Verifica dati prima di inviare a VB.NET
    puts "═══════════════════════════════════════════════════════════════════════════"
    puts "🔍 [VBNetClient] DEBUG: start_orchestrator_session - Data verification"
    puts "═══════════════════════════════════════════════════════════════════════════"
    puts "[VBNetClient] ddts.nil?=#{ddts.nil?}"
    puts "[VBNetClient] ddts.length=#{ddts.nil? ? 0 : ddts.length}"
    unless ddts.nil? || ddts.empty?
      first_ddt = ddts[0]
      puts "[VBNetClient] ddts[0].nil?=#{first_ddt.nil?}"
      unless first_ddt.nil?
        puts "[VBNetClient] ddts[0]['id']=#{first_ddt['id']}"
        puts "[VBNetClient] ddts[0]['data'].nil?=#{first_ddt['data'].nil?}"
        unless first_ddt['data'].nil?
          data = first_ddt['data']
          if data.is_a?(Array)
            puts "[VBNetClient] ddts[0]['data'].length=#{data.length}"
          else
            puts "[VBNetClient] ⚠️ WARNING: ddts[0]['data'] is NOT an Array, type=#{data.class}"
          end
        end
      end
    end
    puts "═══════════════════════════════════════════════════════════════════════════"

    data = {
      compilationResult: compilation_result,
      tasks: tasks || [],
      ddts: ddts || [],
      translations: translations || {}
    }

    call_api('/api/runtime/orchestrator/session/start', data)
  end

  # Send input to orchestrator session
  def self.send_orchestrator_input(session_id, input)
    uri = URI.parse("#{API_SERVER_BASE_URL}/api/runtime/orchestrator/session/#{session_id}/input")

    http = Net::HTTP.new(uri.host, uri.port)
    http.read_timeout = 30
    http.open_timeout = 5

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Accept'] = 'application/json'
    request.body = { input: input }.to_json

    puts "[VBNetClient] 📤 Sending input to session #{session_id}: #{input}"

    begin
      response = http.request(request)

      puts "[VBNetClient] 📥 Response: #{response.code} #{response.message}"

      case response.code.to_i
      when 200..299
        JSON.parse(response.body) rescue {}
      else
        error_data = JSON.parse(response.body) rescue { error: response.body }
        raise "ApiServer returned error (#{response.code}): #{error_data['error'] || error_data['message'] || 'Unknown error'}"
      end
    rescue Errno::ECONNREFUSED => e
      raise "Cannot connect to ApiServer at #{API_SERVER_BASE_URL}: #{e.message}"
    rescue StandardError => e
      raise "Error sending input: #{e.message}"
    end
  end

  # Delete orchestrator session
  def self.delete_orchestrator_session(session_id)
    uri = URI.parse("#{API_SERVER_BASE_URL}/api/runtime/orchestrator/session/#{session_id}")

    http = Net::HTTP.new(uri.host, uri.port)
    http.read_timeout = 10
    http.open_timeout = 5

    request = Net::HTTP::Delete.new(uri.path)
    request['Accept'] = 'application/json'

    puts "[VBNetClient] 🗑️  Deleting session #{session_id}"

    begin
      response = http.request(request)
      puts "[VBNetClient] 📥 Response: #{response.code} #{response.message}"
      response.code.to_i == 200 || response.code.to_i == 204
    rescue Errno::ECONNREFUSED => e
      puts "[VBNetClient] ⚠️  Cannot connect to ApiServer: #{e.message}"
      false
    rescue StandardError => e
      puts "[VBNetClient] ⚠️  Error deleting session: #{e.message}"
      false
    end
  end

  private

  # Make HTTP POST request to ApiServer
  def self.call_api(endpoint, data)
    uri = URI.parse("#{API_SERVER_BASE_URL}#{endpoint}")

    http = Net::HTTP.new(uri.host, uri.port)
    http.read_timeout = 30 # 30 seconds timeout
    http.open_timeout = 5  # 5 seconds to connect

    request = Net::HTTP::Post.new(uri.path)
    request['Content-Type'] = 'application/json'
    request['Accept'] = 'application/json'
    request.body = data.to_json

    puts "[VBNetClient] 📤 Calling ApiServer: POST #{endpoint}"
    puts "[VBNetClient]    URL: #{uri}"
    puts "[VBNetClient]    Payload size: #{request.body.bytesize} bytes"

    begin
      response = http.request(request)

      puts "[VBNetClient] 📥 Response: #{response.code} #{response.message}"

      case response.code.to_i
      when 200..299
        # Success
        result = JSON.parse(response.body)
        puts "[VBNetClient] ✅ Request successful"
        result
      when 400..499
        # Client error
        error_data = JSON.parse(response.body) rescue { error: response.body }
        raise <<~ERROR
          ❌ ApiServer returned client error (#{response.code})

          Endpoint: POST #{endpoint}
          Error: #{error_data['error'] || error_data['message'] || 'Unknown error'}

          Response body:
          #{response.body}
        ERROR
      when 500..599
        # Server error
        error_data = JSON.parse(response.body) rescue { error: response.body }
        raise <<~ERROR
          ❌ ApiServer returned server error (#{response.code})

          Endpoint: POST #{endpoint}
          Error: #{error_data['error'] || error_data['message'] || 'Internal server error'}

          Response body:
          #{response.body}
        ERROR
      else
        raise "Unexpected HTTP response code: #{response.code}"
      end
    rescue Errno::ECONNREFUSED => e
      raise <<~ERROR
        ❌ Cannot connect to ApiServer at #{API_SERVER_BASE_URL}

        The VB.NET ApiServer is not running.

        To start ApiServer:
          cd VBNET/ApiServer
          dotnet run

        Or:
          dotnet run --project VBNET/ApiServer/ApiServer.vbproj

        Original error: #{e.message}
      ERROR
    rescue Timeout::Error => e
      raise <<~ERROR
        ❌ Request to ApiServer timed out

        Endpoint: POST #{endpoint}
        Timeout: #{http.read_timeout} seconds

        The ApiServer may be overloaded or unresponsive.

        Original error: #{e.message}
      ERROR
    rescue JSON::ParserError => e
      raise <<~ERROR
        ❌ ApiServer returned invalid JSON

        Endpoint: POST #{endpoint}
        Response code: #{response.code}
        Parse error: #{e.message}

        Raw response:
        #{response.body}
      ERROR
    rescue StandardError => e
      raise <<~ERROR
        ❌ Unexpected error calling ApiServer

        Endpoint: POST #{endpoint}
        Error class: #{e.class}
        Error message: #{e.message}

        Backtrace:
        #{e.backtrace.first(5).join("\n")}
      ERROR
    end
  end

  # Health check - verify ApiServer is running
  def self.health_check
    uri = URI.parse("#{API_SERVER_BASE_URL}/api/health")

    begin
      response = Net::HTTP.get_response(uri)

      if response.code.to_i == 200
        data = JSON.parse(response.body)
        puts "[VBNetClient] ✅ ApiServer is healthy: #{data}"
        true
      else
        puts "[VBNetClient] ⚠️  ApiServer returned #{response.code}"
        false
      end
    rescue Errno::ECONNREFUSED
      puts "[VBNetClient] ❌ ApiServer is not running at #{API_SERVER_BASE_URL}"
      false
    rescue StandardError => e
      puts "[VBNetClient] ❌ Health check failed: #{e.message}"
      false
    end
  end
end
