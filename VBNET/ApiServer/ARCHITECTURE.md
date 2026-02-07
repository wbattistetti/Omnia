# Architecture Documentation - ApiServer Refactoring

## Overview

This document describes the refactored architecture of the ApiServer, aligned with CTO's production guidelines.

## Phase 1: Structured Logging + Interfaces

### Components

#### ILogger Interface
- **Location**: `ApiServer/Interfaces/ILogger.vb`
- **Purpose**: Abstract logging contract for structured logging
- **Methods**:
  - `LogDebug(message, data)`: Technical details
  - `LogInfo(message, data)`: Normal events
  - `LogWarning(message, data)`: Anomalous but non-critical situations
  - `LogError(message, ex, data)`: Exceptions and critical issues

#### StdoutLogger Implementation
- **Location**: `ApiServer/Logging/StdoutLogger.vb`
- **Purpose**: Writes structured JSON logs to stdout
- **Format**: JSON with timestamp, level, message, data, exception
- **Compatibility**: Meets observability requirements (logs to stdout)

#### ISessionStorage Interface
- **Location**: `ApiServer/Interfaces/ISessionStorage.vb`
- **Purpose**: Abstracts session storage mechanism
- **Methods**:
  - `GetTaskSession(sessionId)`: Retrieve TaskSession
  - `SaveTaskSession(session)`: Save TaskSession
  - `DeleteTaskSession(sessionId)`: Delete TaskSession
  - `GetOrchestratorSession(sessionId)`: Retrieve OrchestratorSession
  - `SaveOrchestratorSession(session)`: Save OrchestratorSession
  - `DeleteOrchestratorSession(sessionId)`: Delete OrchestratorSession

#### InMemorySessionStorage Implementation
- **Location**: `ApiServer/SessionStorage/InMemorySessionStorage.vb`
- **Purpose**: In-memory session storage (backward compatible)
- **Usage**: Default implementation, wraps existing SessionManager logic

## Phase 2: Dependency Injection + Structured Logging

### Dependency Injection Configuration

**Location**: `ApiServer/Program.vb`

```vb
' Register ILogger as singleton
Dim logger As ApiServer.Interfaces.ILogger = New ApiServer.Logging.StdoutLogger()
builder.Services.AddSingleton(Of ApiServer.Interfaces.ILogger)(logger)

' Register ISessionStorage as singleton (default: InMemory)
Dim storage As ApiServer.Interfaces.ISessionStorage = New ApiServer.SessionStorage.InMemorySessionStorage()
builder.Services.AddSingleton(Of ApiServer.Interfaces.ISessionStorage)(storage)

' Configure SessionManager and TaskSessionHandlers
SessionManager.ConfigureStorage(storage)
SessionManager.ConfigureLogger(logger)
ApiServer.Handlers.TaskSessionHandlers.ConfigureLogger(logger)
```

### Logging Integration

#### SessionManager
- Uses `ILogger` for all logging operations
- Replaces `Console.WriteLine` with structured logging
- Maintains backward compatibility

#### TaskSessionHandlers
- Static logger with helper methods (`LogDebug`, `LogInfo`, `LogError`)
- Fallback to `Console.WriteLine` if logger not available
- Key operations logged with structured data

## Phase 3: Stateless Preparation

### RedisSessionStorage (Stub)

**Location**: `ApiServer/SessionStorage/RedisSessionStorage.vb`

- **Status**: Placeholder for future Redis implementation
- **Current Behavior**: Delegates to `InMemorySessionStorage` (backward compatible)
- **Future Implementation**:
  1. Add StackExchange.Redis NuGet package
  2. Configure connection string in appsettings.json
  3. Implement JSON serialization/deserialization for sessions
  4. Handle TTL (Time To Live) for sessions (e.g., 1 hour)
  5. Handle connection errors and fallback

**Suggested Pattern**:
- Key format: `"session:task:{sessionId}"` and `"session:orchestrator:{sessionId}"`
- TTL: 3600 seconds (1 hour)
- Serialization: JSON with Newtonsoft.Json
- Fallback: InMemorySessionStorage if Redis unavailable

## Architecture Patterns

### Dependency Injection
- **Pattern**: Constructor/Static Configuration Injection
- **Usage**: Services registered in `Program.vb`, configured via static methods
- **Benefits**: Testability, flexibility, separation of concerns

### Interface Segregation
- **Pattern**: Small, focused interfaces (`ILogger`, `ISessionStorage`)
- **Benefits**: Easy to swap implementations, test with mocks

### Strategy Pattern
- **Pattern**: `ISessionStorage` allows different storage strategies
- **Implementations**: `InMemorySessionStorage`, `RedisSessionStorage` (future)
- **Benefits**: Easy migration from in-memory to distributed storage

### Structured Logging
- **Pattern**: JSON logs to stdout
- **Format**: `{timestamp, level, message, data, exception}`
- **Benefits**: Easy parsing, observability, production-ready

## Stateful vs Stateless Components

### Current State (Phase 1-3)

**Stateful Components**:
- `SessionManager`: Manages sessions in memory (via `InMemorySessionStorage`)
- `FlowOrchestrator`: Internal execution state
- `TaskEngine`: Internal dialogue state and counters

**Stateless Components**:
- `TaskCompiler`: Pure compilation logic
- `TaskAssembler`: Pure assembly logic
- `Parser`: NLP parsing (with local cache)

### Future Migration (Phase 4+)

**Target**: Make all components stateless

**Strategy**:
1. Migrate session state to Redis (`RedisSessionStorage`)
2. Extract `FlowOrchestrator` state to Redis
3. Extract `TaskEngine` state to Redis
4. Use stateless service instances

**Benefits**:
- Horizontal scaling
- Fault tolerance
- Load balancing

## Compatibility with CTO Guidelines

### ✅ Mandatory/Recommended

- **Docker**: Ready for containerization (no changes needed)
- **Stateless Services**: Architecture prepared (interfaces ready, Redis stub created)
- **REST Communication**: Already using REST API
- **Observability**: Structured logging to stdout (JSON format)
- **Modularization**: Good separation of concerns, interfaces for abstraction

### ⚠️ Future Work

- **Redis Implementation**: Stub created, needs full implementation
- **State Migration**: Interfaces ready, needs migration logic
- **Metrics/Tracing**: Logging ready, metrics/tracing to be added later

## Testing Strategy

### Unit Testing
- Mock `ILogger` and `ISessionStorage` for testing
- Test business logic without dependencies

### Integration Testing
- Test with `InMemorySessionStorage` (fast, no external dependencies)
- Test with `RedisSessionStorage` (when implemented)

### Backward Compatibility
- All changes maintain backward compatibility
- Existing code continues to work
- Gradual migration possible

## Migration Path

### From InMemory to Redis

1. **Phase 1-3** (Current): Interfaces and DI configured
2. **Phase 4** (Future): Implement `RedisSessionStorage`
3. **Phase 5** (Future): Migrate state from in-memory to Redis
4. **Phase 6** (Future): Remove in-memory dictionaries, use Redis only

### Configuration

```vb
' Current (Phase 1-3)
Dim storage As ISessionStorage = New InMemorySessionStorage()

' Future (Phase 4+)
Dim storage As ISessionStorage = New RedisSessionStorage(connectionString)
```

## Code Quality Improvements

### Maintainability
- ✅ Interfaces reduce coupling
- ✅ Dependency Injection improves testability
- ✅ Structured logging improves debugging
- ✅ Clear separation of concerns

### Scalability
- ✅ Architecture ready for horizontal scaling
- ✅ State abstraction allows distributed storage
- ✅ Stateless components can scale independently

### Observability
- ✅ Structured JSON logs
- ✅ Log levels (DEBUG, INFO, WARNING, ERROR)
- ✅ Contextual data in logs
- ✅ Exception details included

## Next Steps

1. **Implement RedisSessionStorage**: Add StackExchange.Redis, implement full Redis support
2. **Migrate State**: Move session state from in-memory to Redis
3. **Add Metrics**: Integrate metrics collection (Prometheus, etc.)
4. **Add Tracing**: Integrate distributed tracing (OpenTelemetry, etc.)
5. **Performance Testing**: Load testing with Redis
6. **Documentation**: API documentation, deployment guides

---

**Last Updated**: Phase 3 Completion
**Status**: ✅ Production-ready foundation, ready for Redis migration
