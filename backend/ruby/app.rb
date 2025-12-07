require 'sinatra'
require 'json'
require 'securerandom'
require_relative 'lib/vbnet_client'
require_relative 'routes/runtime'

set :port, 3101
set :bind, '0.0.0.0'

# Enable CORS
before do
  headers 'Access-Control-Allow-Origin' => '*',
          'Access-Control-Allow-Methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          'Access-Control-Allow-Headers' => 'Content-Type, Authorization'
end

options '*' do
  200
end

get '/' do
  content_type :json
  {
    status: 'ok',
    service: 'VB.NET Runtime API Server',
    version: '1.0.0',
    timestamp: Time.now.iso8601
  }.to_json
end

