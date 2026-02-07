# Migration Guide - From InMemory to Redis

## Overview

This guide explains how to migrate from `InMemorySessionStorage` to `RedisSessionStorage` when you're ready to scale horizontally.

## Current State (Phase 1-3)

- **Storage**: `InMemorySessionStorage` (default)
- **Sessions**: Stored in-memory dictionaries
- **Scaling**: Vertical only (single instance)
- **State**: Local to process

## Target State (Phase 4+)

- **Storage**: `RedisSessionStorage`
- **Sessions**: Stored in Redis cluster
- **Scaling**: Horizontal (multiple instances)
- **State**: Distributed, shared across instances

## Prerequisites

1. **Redis Instance**:
   - Local: Docker `docker run -d -p 6379:6379 redis:latest`
   - Cloud: AWS ElastiCache, Azure Cache, GCP Memorystore
   - Connection string format: `localhost:6379` or `redis://host:port`

2. **NuGet Package**:
   ```xml
   <PackageReference Include="StackExchange.Redis" Version="2.7.10" />
   ```

3. **Configuration**: Add to `appsettings.json`:
   ```json
   {
     "Redis": {
       "ConnectionString": "localhost:6379",
       "Database": 0,
       "KeyPrefix": "omnia:session:"
     }
   }
   ```

## Step-by-Step Migration

### Step 1: Add Redis Package

```bash
cd VBNET/ApiServer
dotnet add package StackExchange.Redis --version 2.7.10
```

### Step 2: Implement RedisSessionStorage

Update `VBNET/ApiServer/SessionStorage/RedisSessionStorage.vb`:

```vb
Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports ApiServer.Interfaces
Imports Compiler
Imports TaskEngine
Imports Newtonsoft.Json
Imports StackExchange.Redis
Imports Microsoft.Extensions.Configuration

Namespace ApiServer.SessionStorage
    Public Class RedisSessionStorage
        Implements ApiServer.Interfaces.ISessionStorage

        Private ReadOnly _connection As IConnectionMultiplexer
        Private ReadOnly _database As IDatabase
        Private ReadOnly _keyPrefix As String
        Private ReadOnly _fallbackStorage As InMemorySessionStorage
        Private ReadOnly _isRedisAvailable As Boolean

        Public Sub New(connectionString As String, Optional keyPrefix As String = "omnia:session:")
            Try
                _connection = ConnectionMultiplexer.Connect(connectionString)
                _database = _connection.GetDatabase()
                _keyPrefix = keyPrefix
                _isRedisAvailable = _connection.IsConnected
                _fallbackStorage = New InMemorySessionStorage()
            Catch ex As Exception
                ' Fallback to in-memory if Redis unavailable
                _isRedisAvailable = False
                _fallbackStorage = New InMemorySessionStorage()
                ' Log error (use Console for now, logger might not be available)
                Console.WriteLine($"[RedisSessionStorage] Failed to connect to Redis: {ex.Message}. Using fallback.")
            End Try
        End Sub

        Private Function GetTaskSessionKey(sessionId As String) As String
            Return $"{_keyPrefix}task:{sessionId}"
        End Function

        Private Function GetOrchestratorSessionKey(sessionId As String) As String
            Return $"{_keyPrefix}orchestrator:{sessionId}"
        End Function

        Public Function GetTaskSession(sessionId As String) As TaskSession Implements ApiServer.Interfaces.ISessionStorage.GetTaskSession
            If Not _isRedisAvailable Then
                Return _fallbackStorage.GetTaskSession(sessionId)
            End If

            Try
                Dim key = GetTaskSessionKey(sessionId)
                Dim json = _database.StringGet(key)

                If json.HasValue Then
                    Return JsonConvert.DeserializeObject(Of TaskSession)(json)
                End If

                Return Nothing
            Catch ex As Exception
                ' Fallback on error
                Console.WriteLine($"[RedisSessionStorage] Error getting task session: {ex.Message}")
                Return _fallbackStorage.GetTaskSession(sessionId)
            End Try
        End Function

        Public Sub SaveTaskSession(session As TaskSession) Implements ApiServer.Interfaces.ISessionStorage.SaveTaskSession
            If Not _isRedisAvailable Then
                _fallbackStorage.SaveTaskSession(session)
                Return
            End If

            Try
                Dim key = GetTaskSessionKey(session.SessionId)
                Dim json = JsonConvert.SerializeObject(session, New JsonSerializerSettings With {
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore
                })

                ' TTL: 1 hour (3600 seconds)
                _database.StringSet(key, json, TimeSpan.FromSeconds(3600))
            Catch ex As Exception
                ' Fallback on error
                Console.WriteLine($"[RedisSessionStorage] Error saving task session: {ex.Message}")
                _fallbackStorage.SaveTaskSession(session)
            End Try
        End Sub

        Public Sub DeleteTaskSession(sessionId As String) Implements ApiServer.Interfaces.ISessionStorage.DeleteTaskSession
            If Not _isRedisAvailable Then
                _fallbackStorage.DeleteTaskSession(sessionId)
                Return
            End If

            Try
                Dim key = GetTaskSessionKey(sessionId)
                _database.KeyDelete(key)
            Catch ex As Exception
                ' Fallback on error
                Console.WriteLine($"[RedisSessionStorage] Error deleting task session: {ex.Message}")
                _fallbackStorage.DeleteTaskSession(sessionId)
            End Try
        End Sub

        ' Similar implementation for OrchestratorSession...
        ' (GetOrchestratorSession, SaveOrchestratorSession, DeleteOrchestratorSession)

        Public Sub Dispose()
            _connection?.Dispose()
        End Sub
    End Class
End Namespace
```

### Step 3: Update Program.vb

Replace `InMemorySessionStorage` with `RedisSessionStorage`:

```vb
' Before (Phase 1-3)
Dim storage As ApiServer.Interfaces.ISessionStorage = New ApiServer.SessionStorage.InMemorySessionStorage()

' After (Phase 4+)
Dim redisConnectionString = builder.Configuration.GetValue(Of String)("Redis:ConnectionString", "localhost:6379")
Dim storage As ApiServer.Interfaces.ISessionStorage = New ApiServer.SessionStorage.RedisSessionStorage(redisConnectionString)
```

### Step 4: Add Configuration

Create/update `appsettings.json`:

```json
{
  "Redis": {
    "ConnectionString": "localhost:6379",
    "KeyPrefix": "omnia:session:"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

### Step 5: Test Migration

1. **Start Redis**: `docker run -d -p 6379:6379 redis:latest`
2. **Update Configuration**: Set Redis connection string
3. **Restart Server**: ApiServer will use Redis
4. **Test Chat Simulator**: Verify sessions work
5. **Check Redis**: `redis-cli KEYS "omnia:session:*"`

## Rollback Plan

If Redis causes issues, rollback is simple:

```vb
' Just change back to InMemorySessionStorage
Dim storage As ApiServer.Interfaces.ISessionStorage = New ApiServer.SessionStorage.InMemorySessionStorage()
```

No code changes needed elsewhere - the interface abstraction makes this trivial.

## Performance Considerations

### Redis Benefits
- **Horizontal Scaling**: Multiple ApiServer instances share state
- **Persistence**: Sessions survive server restarts (if AOF enabled)
- **TTL**: Automatic session expiration
- **Performance**: Sub-millisecond access times

### Redis Considerations
- **Network Latency**: Slight increase vs in-memory (usually < 1ms)
- **Serialization**: JSON serialization overhead
- **Connection Pooling**: Use connection multiplexer (already in code)
- **Error Handling**: Always have fallback to in-memory

## Monitoring

### Redis Metrics to Monitor
- Connection status
- Memory usage
- Key count
- Hit/miss ratio
- Latency (p50, p95, p99)

### Application Metrics
- Session creation rate
- Session retrieval time
- Fallback usage (if Redis unavailable)
- Error rate

## Troubleshooting

### Redis Connection Fails
- **Symptom**: Fallback to InMemorySessionStorage
- **Check**: Redis server running, connection string correct
- **Solution**: Verify Redis is accessible, check firewall

### Serialization Errors
- **Symptom**: Sessions not saving/loading correctly
- **Check**: JSON serialization settings
- **Solution**: Ensure `ReferenceLoopHandling.Ignore` is set

### Performance Issues
- **Symptom**: Slow session operations
- **Check**: Redis latency, network issues
- **Solution**: Use Redis cluster, connection pooling, local Redis for dev

## Next Steps After Migration

1. **Remove InMemory Fallback**: Once Redis is stable
2. **Add Redis Clustering**: For high availability
3. **Implement Session Backup**: Async backup to database
4. **Add Metrics**: Monitor Redis performance
5. **Load Testing**: Verify horizontal scaling works

---

**Status**: Ready for implementation when needed
**Estimated Time**: 2-4 hours for full implementation
**Risk**: Low (fallback mechanism in place)
