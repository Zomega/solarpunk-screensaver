// --- trace_grammar.pegjs (Updated with Correct Peg.js Syntax) ---

// The start rule, expects one or more PathCommands
Path
  = _ results:(PathCommand _)* { return results.filter(r => r); }

// All possible commands
PathCommand
  = MoveTo / LineTo / HorizontalLineTo / VerticalLineTo / ClosePath / OvalCommand

// === CORE SVG PATH COMMANDS ===

// M: MoveTo command
MoveTo "M"
  = "M" _ coordinate:Coordinate _ { return { command: 'M', coordinate: coordinate }; }

// L: LineTo command
LineTo "L"
  = "L" _ coordinate:Coordinate _ { return { command: 'L', coordinate: coordinate }; }
  
// H: Horizontal LineTo command
// Note: This command is followed by a Coordinate, but only its X value is used
HorizontalLineTo "H"
  = "H" _ coordinate:Coordinate _ { return { command: 'H', coordinate: coordinate }; }

// V: Vertical LineTo command
// Note: This command is followed by a Coordinate, but only its Y value is used
VerticalLineTo "V"
  = "V" _ coordinate:Coordinate _ { return { command: 'V', coordinate: coordinate }; }

// Z: ClosePath command
ClosePath "Z"
  = "Z" _ { return { command: 'Z' }; }

// O: Example loop/border command (from source 5)
OvalCommand "O"
  = "O" _ element:ElementRef _ { return { command: 'O', element: element }; }

// === COORDINATES AND REFERENCES ===

// A generic Coordinate, which is either an ElementRef or an AnonPoint
Coordinate
  = ElementRef / AnonPoint

// An anonymous point (_), used for relative steps (source 4)
AnonPoint "_"
  = "_" { return { type: 'anon' }; }

// An element reference, e.g., #lbar.tr.clip(20)
ElementRef
  = "#" element_id:Identifier corner:( "." Corner )? modifiers:(Modifier)* { 
      return { 
        type: 'element', 
        id: element_id, 
        corner: corner ? corner[1] : null, 
        modifiers: modifiers
      }; 
    }

// Defines a corner: tl, tr, bl, br, leftside, rightside
Corner
  = "tl" / "tr" / "bl" / "br" / "leftside" / "rightside"

// === MODIFIERS ===

// All possible path point modifiers
Modifier
  = ClipModifier / OffsetModifier / OffsetXModifier / OffsetYModifier / AtModifier

ClipModifier
  = ".clip(" value:Value ")" { return { type: 'clip', value: value }; }
  
OffsetModifier
  = ".offset(" value:Value ")" { return { type: 'offset', value: value }; }

OffsetXModifier
  = ".offsetx(" value:Value ")" { return { type: 'offsetx', value: value }; }

OffsetYModifier
  = ".offsety(" value:Value ")" { return { type: 'offsety', value: value }; }

AtModifier
  = ".at(" value:Value ")" { return { type: 'at', value: value }; }


// === BASIC UTILITY RULES ===

// A value can be a percentage (e.g., 50%) or a number (e.g., 20)
Value
  = Percent / Number

Percent
  = number:Number "%" { return { type: 'percent', value: number }; }

// A number (integer or decimal)
Number
  = text:(("-"? [0-9]+ ("." [0-9]+)?)) { return parseFloat(text.flat().join('')); }

// An identifier for an element (source: 2, 3, 4, 5)
Identifier
  = text:([a-zA-Z0-9_-]+) { return text.join(""); }

// Optional whitespace between commands/tokens
_ "whitespace"
  = [ \t\n\r]*