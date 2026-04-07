Option Strict On
Option Explicit On

''' <summary>Esito del parse <see cref="GrammarEngine.Parse"/> (GrammarFlow).</summary>
Public Enum ParseEvents
    ''' <summary>Match con bindings utilizzabili.</summary>
    Match
    ''' <summary>Input vuoto o solo whitespace.</summary>
    NoInput
    ''' <summary>Nessun match (regex o navigazione).</summary>
    NoMatch
    ''' <summary>Grammatica non utilizzabile (es. nessun entry node).</summary>
    InvalidGrammar
End Enum
