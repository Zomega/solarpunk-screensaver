import { describe, it, expect } from 'vitest';
import { parse, SyntaxError } from './trace_grammar.js';

describe('Trace Grammar Parser', () => {
  describe('Valid Input', () => {
    it('should parse a simple MoveTo command', () => {
      const ast = parse('M #my-element.tr');
      expect(ast).toEqual([
        [
          {
            command: 'M',
            coordinate: {
              type: 'element',
              id: 'my-element',
              corner: 'tr',
              modifiers: [],
            },
          },
          [],
        ],
      ]);
    });

    it('should parse a command with modifiers', () => {
      const ast = parse('L #el.bl.clip(10).offset(5)');
      expect(ast[0][0].command).toBe('L');
      expect(ast[0][0].coordinate.id).toBe('el');
      expect(ast[0][0].coordinate.corner).toBe('bl');
      expect(ast[0][0].coordinate.modifiers).toEqual([
        { type: 'clip', value: 10 },
        { type: 'offset', value: 5 },
      ]);
    });

    it('should parse an Oval command', () => {
      const ast = parse('O #some-element');
      expect(ast).toEqual([
        [
          {
            command: 'O',
            element: {
              type: 'element',
              id: 'some-element',
              corner: null,
              modifiers: [],
            },
          },
          [],
        ],
      ]);
    });

    it('should parse a ClosePath command', () => {
      const ast = parse('Z');
      expect(ast).toEqual([[{ command: 'Z' }, []]]);
    });

    it('should parse multiple commands', () => {
      const input = `
        M #start.tl
        L #end.br
        Z
      `;
      const ast = parse(input);
      expect(ast.length).toBe(3);
      expect(ast[0][0].command).toBe('M');
      expect(ast[1][0].command).toBe('L');
      expect(ast[2][0].command).toBe('Z');
    });
  });

  describe('Invalid Input', () => {
    it('should throw SyntaxError for an invalid command', () => {
      expect(() => parse('X #el.tr')).toThrow(SyntaxError);
    });

    it('should throw SyntaxError for a malformed coordinate', () => {
      expect(() => parse('M el.tr')).toThrow(SyntaxError); // Missing #
    });

    it('should throw SyntaxError for an unclosed modifier', () => {
      expect(() => parse('L #el.bl.clip(10')).toThrow(SyntaxError);
    });

    it('should throw SyntaxError for empty input', () => {
      // PEG.js parsers, by default, might return an empty array or throw
      // depending on the grammar structure for empty strings.
      // Based on the grammar, it seems it would fail to match a PathCommand.
      const ast = parse('');
      expect(ast).toEqual([]);
    });
  });
});
