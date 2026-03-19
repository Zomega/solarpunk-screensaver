import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Traces from './traces.js';
import * as TraceGrammar from './trace_grammar.js';

// Mock the parse function
vi.mock('./trace_grammar.js', () => ({
  parse: vi.fn(),
}));

describe('traces.js', () => {
  let traceOverlay;
  const originalGetElementById = document.getElementById.bind(document);

  beforeEach(() => {
    // Reset mocks and DOM
    vi.resetAllMocks();
    document.body.innerHTML = '<svg id="trace-overlay"></svg>';
    traceOverlay = originalGetElementById('trace-overlay');

    const mockElement = {
      getBoundingClientRect: () => ({
        top: 10,
        left: 20,
        right: 120,
        bottom: 60,
        width: 100,
        height: 50,
      }),
    };

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'test-el') {
        return mockElement;
      }
      return originalGetElementById(id);
    });
  });

  describe('Public API', () => {
    it('addTrace should add a trace and update the SVG', () => {
      const pathstring = 'M #test-el.tl';
      const ast = [
        [
          {
            command: 'M',
            coordinate: {
              type: 'element',
              id: 'test-el',
              corner: 'tl',
              modifiers: [],
            },
          },
        ],
      ];
      TraceGrammar.parse.mockReturnValue(ast);

      Traces.addTrace(pathstring, 'trace1');

      const path = traceOverlay.querySelector('#trace-trace1');
      expect(path).not.toBeNull();
      expect(path.getAttribute('d')).toBe('M 20,10');
      expect(path.getAttribute('stroke')).toBe('blue'); // Default color
    });

    it('removeTrace should remove a trace from the SVG', () => {
      const ast = [
        [
          {
            command: 'M',
            coordinate: {
              type: 'element',
              id: 'test-el',
              corner: 'tl',
              modifiers: [],
            },
          },
        ],
      ];
      TraceGrammar.parse.mockReturnValue(ast);
      Traces.addTrace('M #test-el.tl', 'trace1');
      expect(traceOverlay.querySelector('#trace-trace1')).not.toBeNull();

      Traces.removeTrace('trace1');

      const ast2 = [
        [
          {
            command: 'M',
            coordinate: {
              type: 'element',
              id: 'test-el',
              corner: 'br',
              modifiers: [],
            },
          },
        ],
      ];
      TraceGrammar.parse.mockReturnValue(ast2);
      Traces.addTrace('M #test-el.br', 'trace2');

      expect(traceOverlay.querySelector('#trace-trace1')).toBeNull();
      expect(traceOverlay.querySelector('#trace-trace2')).not.toBeNull();
    });

    it('clearAllTraces should remove all traces', () => {
      const ast = [
        [
          {
            command: 'M',
            coordinate: {
              type: 'element',
              id: 'test-el',
              corner: 'tl',
              modifiers: [],
            },
          },
        ],
      ];
      TraceGrammar.parse.mockReturnValue(ast);

      Traces.addTrace('M #test-el.tl', 'trace1');
      const ast2 = [
        [
          {
            command: 'M',
            coordinate: {
              type: 'element',
              id: 'test-el',
              corner: 'br',
              modifiers: [],
            },
          },
        ],
      ];
      TraceGrammar.parse.mockReturnValue(ast2);
      Traces.addTrace('M #test-el.br', 'trace2');
      expect(traceOverlay.querySelectorAll('path').length).toBe(2);

      Traces.clearAllTraces();

      const ast3 = [
        [
          {
            command: 'M',
            coordinate: {
              type: 'element',
              id: 'test-el',
              corner: 'tr',
              modifiers: [],
            },
          },
        ],
      ];
      TraceGrammar.parse.mockReturnValue(ast3);
      Traces.addTrace('M #test-el.tr', 'trace3');

      expect(traceOverlay.querySelectorAll('path').length).toBe(1);
      expect(traceOverlay.querySelector('#trace-trace3')).not.toBeNull();
    });
  });

  describe('Coordinate and Path Logic', () => {
    it('getElementPosition should return a DOMRect for a valid element', () => {
      const el = document.createElement('div');
      el.id = 'real-element';
      document.body.appendChild(el);
      const rect = Traces.getElementPosition('real-element');
      expect(rect).toBeInstanceOf(DOMRect);
    });
  });
});
