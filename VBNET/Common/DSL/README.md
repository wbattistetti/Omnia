# DSL Interpreter

Minimal DSL interpreter for evaluating conditions at runtime in VB.NET.

## Architecture

- **ASTNode.vb**: AST data model for JSON deserialization
- **DSLInterpreter.vb**: Recursive AST evaluator (core logic)
- **IConditionLoader.vb**: Interface for loading conditions from repository

## Usage

### 1. Implement IConditionLoader

```vb
Public Class MyConditionLoader
    Implements IConditionLoader

    Public Function LoadCondition(conditionId As String) As Dictionary(Of String, Object) Implements IConditionLoader.LoadCondition
        ' Load condition from database/API
        ' Return condition.Data dictionary with "ast" key containing JSON string
    End Function
End Class
```

### 2. Configure ConditionEvaluator

```vb
' Set condition loader before evaluating conditions
ConditionEvaluator.ConditionLoader = New MyConditionLoader()
```

### 3. Evaluate Conditions

The `ConditionEvaluator.EvaluateCondition()` method will automatically use the DSL interpreter for `EdgeCondition` types.

## AST Structure

The AST is saved as JSON in `condition.data.ast` with this structure:

```json
{
  "type": "equals",
  "left": {
    "type": "variable",
    "name": "Età"
  },
  "right": {
    "type": "literal",
    "value": 18
  }
}
```

## Supported DSL Features

- **Variables**: `[VariableName]`
- **Literals**: strings, numbers, booleans
- **Operators**: `=`, `<>`, `>`, `<`, `>=`, `<=`
- **Logical**: `AND`, `OR`, `NOT`
- **Functions**: `LCase`, `UCase`, `Trim`, `Len`, `Contains`, `StartsWith`, `EndsWith`, `Int`

## Example Conditions

```
[Età] >= 18
[Partenza] = "Milano"
LCase([Città]) = "roma"
[Età] >= 18 AND [Nazionalità] = "Italiana"
Contains([Testo], "ciao")
```
