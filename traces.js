import { parse } from './trace_grammar.js';

const traceInstances = new Map();
const resizeObserver = new ResizeObserver(updateTraces);
resizeObserver.observe(document.body);
window.addEventListener('scroll', updateTraces);

/**
 * Retrieves the bounding client rectangle for a DOM element by its ID.
 * The coordinates (left, top, right, bottom) are relative to the viewport.
 * This function is used by the path grammar resolver to find element coordinates.
 *
 * @param {string} elementId - The ID of the HTML element.
 * @returns {DOMRect | null} The DOMRect object, or null if the element isn't found.
 */
function getElementPosition(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    // getBoundingClientRect returns the element's size and position relative to the viewport.
    return element.getBoundingClientRect();
  }
  return null;
}

// Export the public functions
export { addTrace, removeTrace, clearAllTraces, getElementPosition };

/**
 * Calculates the starting {x, y} point for a given corner string on a rect.
 * This is based on standard SVG/DOM coordinates.
 */
function calculateCorner(rect, corner) {
  switch (corner) {
    case 'tl':
      return {
        type: 'explicit',
        point: { x: rect.left, y: rect.top },
        corner: 'tl',
      };
    case 'tr':
      return {
        type: 'explicit',
        point: { x: rect.right, y: rect.top },
        corner: 'tr',
      };
    case 'bl':
      return {
        type: 'explicit',
        point: { x: rect.left, y: rect.bottom },
        corner: 'bl',
      };
    case 'br':
      return {
        type: 'explicit',
        point: { x: rect.right, y: rect.bottom },
        corner: 'br',
      };
    case 'leftside':
      return {
        type: 'explicit',
        point: { x: rect.left, y: rect.top + rect.height / 2 },
        corner: 'leftside',
      };
    case 'rightside':
      return {
        type: 'explicit',
        point: { x: rect.right, y: rect.top + rect.height / 2 },
        corner: 'rightside',
      };
    case 'topside':
      return {
        type: 'explicit',
        point: { x: rect.left + rect.width / 2, y: rect.top },
        corner: 'topside',
      };
    case 'bottomside':
      return {
        type: 'explicit',
        point: { x: rect.left + rect.width / 2, y: rect.bottom },
        corner: 'bottomside',
      };
    default:
      console.error('Unhandled corner.', corner);
      return null;
  }
}

/**
 * Applies a clip modifier to a list of initial points based on a corner and value.
 * For each input point, it generates two new points forming a short segment
 * that "clips" the corner inward by 'val'.
 * * @param {Array<Object>} initial - List of point objects: [{type: 'explicit', point: {x, y}, corner: '...'}]
 * @param {string} corner - The corner being clipped ('tl', 'tr', 'br', 'bl').
 * @param {number} val - The clip distance.
 * @returns {Array<Object>} A flattened list of all new clipped point objects.
 */
function applyClipModifier(initial, val) {
  // 1. Guard for zero value
  if (val === 0) {
    return initial;
  }

  console.log('PRE-clip', initial);

  // 2. Use flatMap to iterate over every initial point and flatten the results.
  // Each initial point will be replaced by two new clipped points.
  return initial.flatMap((p) => {
    const x = p.point.x;
    const y = p.point.y;

    let points = [];

    // Use switch statement for corner-specific logic
    switch (p.corner) {
      case 'tl':
        points = [
          { type: 'explicit', point: { x: x, y: y + val } },
          { type: 'explicit', point: { x: x + val, y: y } },
        ];
        break;

      case 'tr':
        points = [
          { type: 'explicit', point: { x: x - val, y: y } },
          { type: 'explicit', point: { x: x, y: y + val } },
        ];
        break;

      case 'br':
        points = [
          { type: 'explicit', point: { x: x, y: y - val } },
          { type: 'explicit', point: { x: x - val, y: y } },
        ];
        break;

      case 'bl':
        points = [
          { type: 'explicit', point: { x: x + val, y: y } },
          { type: 'explicit', point: { x: x, y: y - val } },
        ];
        break;

      default:
        // If corner is unknown, do nothing.
        points = [p];
        break;
    }

    // Return the new points list for flatMap to combine
    return points;
  });
}

/**
 * Applies an offset modifier to a list of initial points, moving each point
 * OUTWARD from the element edge by 'val'.
 * * @param {Array<Object>} initial - List of point objects: [{type: 'explicit', point: {x, y}, corner: '...'}]
 * @param {string} corner - The corner or side being offset (e.g., 'tl', 'rightside').
 * @param {number} val - The offset distance.
 * @returns {Array<Object>} A list of modified point objects.
 */
function applyOffsetModifier(initial, val) {
  // 1. Guard for zero value
  if (val === 0) {
    return initial;
  }

  console.log('PRE-offset', initial);

  return initial.map((p) => {
    let x = p.point.x;
    let y = p.point.y;
    let corner = p.corner;

    if (corner === 'leftside') {
      x -= val;
    } else if (corner === 'rightside') {
      x += val;
    } else if (corner === 'topside') {
      y -= val;
    } else if (corner === 'bottomside') {
      y += val;
    } else {
      // Horizontal adjustment
      if (corner.includes('l')) x -= val; // Left
      if (corner.includes('r')) x += val; // Right

      // Vertical adjustment
      if (corner.includes('t')) y -= val; // Top
      if (corner.includes('b')) y += val; // Bottom
    }

    // Return the modified point object, preserving 'type' and 'corner' if present.
    return {
      ...p, // Spread existing properties (like type)
      point: { x, y },
    };
  });
}

function applyOffsetXModifier(initial, val) {
  console.log('PRE-offsetx', initial);
  let x = initial[0].point.x;
  let y = initial[0].point.y;

  // TODO: Redefine this.
  x += val;
  return [
    {
      ...initial[0], // Spread existing properties (like type)
      point: { x, y },
    },
  ];
}

function applyOffsetYModifier(initial, val) {
  console.log('PRE-offsety', initial);
  let x = initial[0].point.x;
  let y = initial[0].point.y;

  // TODO: Redefine this.
  y += val;
  return [
    {
      ...initial[0], // Spread existing properties (like type)
      point: { x, y },
    },
  ];
}

function applyAtModifier(initial, rect, corner, val) {
  console.log('PRE-at', initial);
  let x = initial[0].point.x;
  let y = initial[0].point.y;

  // Calculate width and height from the rect for use in '%' calculations (or 'at')
  // TODO: Figure out how to do this in a reproducable way.
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;

  if (corner.includes('side')) {
    // For vertical sides ('leftside', 'rightside'), 'at' specifies the Y position
    // Assume 'val' is 0 to 1 for fractional position.
    y = rect.top + height * val;
  }
  // Note: Horizontal sides ('topside', 'bottomside') would use width for X.
  // Ignoring 'at' on corner points.
  return [
    {
      type: 'explicit',
      point: { x, y },
    },
  ];
}

/**
 * Applies all modifiers to the base {x, y} coordinate.
 *
 * @param {number} initial - The base coordinate path.
 * @param {Object} rect - The element's bounding rectangle (e.g., {left, top, right, bottom}).
 * @param {string} corner - The corner type (e.g., 'tl', 'tr', 'leftside').
 * @param {Array<Object>|undefined} modifiers - An array of modifier nodes, or undefined.
 * @returns {{x: number, y: number}} The resolved point.
 */
function applyModifiers(initial, rect, corner, modifiers) {
  // FIX: Guard clause to handle undefined or non-array 'modifiers'
  if (!modifiers || !Array.isArray(modifiers)) {
    return initial;
  }

  let current = initial;

  modifiers.forEach((mod) => {
    // Assume 'mod.value' is already a number, potentially resolving percentages elsewhere.
    // If 'val' is NaN due to missing mod.value, the arithmetic will handle it.
    const val = mod.value;

    switch (mod.type) {
      case 'clip':
        current = applyClipModifier(current, val);
        break;
      case 'offset':
        current = applyOffsetModifier(current, val);
        break;
      case 'offsetx':
        current = applyOffsetXModifier(current, val);
        break;
      case 'offsety':
        current = applyOffsetYModifier(current, val);
        break;
      case 'at':
        current = applyAtModifier(initial, rect, corner, val);
        break;
      default:
        console.error('Unhandled modifier.', mod);
        return null;
    }
  });

  return current;
}

/**
 * Resolves an AST coordinate node into a list of points.
 *
 * @param {Object} coord - The coordinate AST node.
 * @returns {{x: number, y: number} | null} The resolved point or null (for 'anon').
 * TODO: rename to resolveCoordinate once usage is migrated.
 */
function resolveCoordinates(coord) {
  // Check if coord object itself is valid before accessing .type
  if (!coord || !coord.type) {
    console.error('Invalid coordinate node passed to resolveCoordinate.');
    return null;
  }

  switch (coord.type) {
    case 'anon':
      return [
        {
          type: 'halfplane_constrained',
          // Unconstrained in practice.
          halfplanes: [],
        },
      ];

    case 'element': {
      // TODO: Handle circular elements.
      const rect = getElementPosition(coord.id);
      if (rect.width === 0 && rect.height === 0) {
        console.error(`Element #${coord.id} has zero size or is off-screen.`);
        return;
      }

      switch (coord.corner) {
        case 'tl':
        case 'tr':
        case 'bl':
        case 'br':
          return applyModifiers(
            [calculateCorner(rect, coord.corner)],
            rect,
            coord.corner,
            coord.modifiers
          );
        case 'leftside':
        case 'rightside':
        case 'topside':
        case 'bottomside':
          // TODO: Maybe better support?
          return applyModifiers(
            [calculateCorner(rect, coord.corner)],
            rect,
            coord.corner,
            coord.modifiers
          );
        case null:
          const corners = ['tl', 'tr', 'br', 'bl'];
          return corners.flatMap((corner) => {
            return applyModifiers(
              [calculateCorner(rect, corner)],
              rect,
              corner,
              coord.modifiers
            );
          });
        default:
          console.error(`TODO: Default`);
          return null;
      }
    }

    default:
      // Should not happen if grammar is correct
      console.error(`Unknown coordinate type '${coord.type}'.`);
      return;
  }
}

/**
 * Processes an Abstract Syntax Tree (AST) of drawing commands to generate a single
 * SVG path data string.
 *
 * @param {Array<Array<Object>>} ast - The AST of commands, where each element is
 * [commandNode, whitespace].
 * @param {Object} lastPoint - The global/scoped variable holding the last resolved point {x, y}.
 * @param {Function} getElementPosition - External function to get element bounds.
 * @param {Function} calculateCorner - External function to get a corner point.
 * @param {Function} applyModifiers - External function to apply offsets/clips.
 * @returns {string} The complete SVG path data string.
 */
function generateSvgPath(ast) {
  let svgPathData = [];
  let lastPoint = null;

  console.log(ast);

  if (!Array.isArray(ast)) {
    console.error(
      'Input AST is not a valid array and cannot be processed.',
      ast
    );
    return svgPathData.join(' '); // Return an empty path string
  }

  ast.forEach((commandWrapper) => {
    // The command object is the first element of the wrapper array: [commandObject, whitespace]
    const commandNode = commandWrapper[0];

    // Safety check
    if (!commandNode || !commandNode.command) {
      console.error('Invalid command node detected:', commandWrapper);
      return;
    }

    const { command } = commandNode;

    if (command === 'M' || command === 'L') {
      const points = resolveCoordinates(commandNode.coordinate);
      // TODO: Reverse only if points are in the wrong order.
      points.reverse();
      const firstPoint = points[0].point;
      svgPathData.push(`${command} ${firstPoint.x},${firstPoint.y}`);

      // LineTo the remaining corners
      for (let i = 1; i < points.length; i++) {
        const point = points[i].point;
        svgPathData.push(`L ${point.x},${point.y}`);
      }
      lastPoint = points[points.length - 1];
    } else if (command === 'H') {
      // TODO: Implement better.
      // The 'assert' becomes a runtime check
      if (!lastPoint) {
        console.error('H command requires a previous point.');
        return;
      }

      const points = resolveCoordinates(commandNode.coordinate);

      const firstPoint = points[0].point;
      svgPathData.push(`H ${firstPoint.x}`);

      // LineTo the remaining corners
      for (let i = 1; i < points.length; i++) {
        const point = points[i].point;
        svgPathData.push(`L ${point.x},${point.y}`);
      }
      lastPoint = points[points.length - 1];
    } else if (command === 'V') {
      // TODO: Implement better.
      // The 'assert' becomes a runtime check
      if (!lastPoint) {
        console.error('H command requires a previous point.');
        return;
      }

      const points = resolveCoordinates(commandNode.coordinate);

      const firstPoint = points[0].point;
      svgPathData.push(`V ${firstPoint.y}`);

      // LineTo the remaining corners
      for (let i = 1; i < points.length; i++) {
        const point = points[i].point;
        svgPathData.push(`L ${point.x},${point.y}`);
      }
      lastPoint = points[points.length - 1];
    } else if (command === 'Z') {
      svgPathData.push('Z');
      // In standard SVG, 'Z' implicitly closes the subpath, moving the current point
      // to the starting point of the current subpath. For simplicity here, we leave
      // the lastPoint update as a TODO, as the original suggested.
      // TODO: Update lastPoint to the starting point of the current subpath.
      // TODO: Assert no following command.
    } else if (command === 'O') {
      // Draw a closed path around the perimeter of the provided element.
      const { id } = commandNode.element;
      if (lastPoint) {
        console.error('O command requires no previous point exists.');
        return;
      }

      const points = resolveCoordinates(commandNode.element);
      console.log('RESOLVED resolveCoordinates', points);

      // TODO: ENSURE ALL POINTS ARE EXPLICIT.
      // TODO: ENSURE AT LEAST TWO ?THREE? POINTS

      // The starting point (MoveTo)
      const firstPoint = points[0].point;
      svgPathData.push(`M ${firstPoint.x},${firstPoint.y}`);

      // LineTo the remaining corners
      for (let i = 1; i < points.length; i++) {
        const point = points[i].point;
        svgPathData.push(`L ${point.x},${point.y}`);
      }

      svgPathData.push(`Z`); // Close the path

      // No update to lastPoint needed

      // TODO: Assert no following command.
    } else {
      console.warn(`Unknown command detected: ${command}`);
    }
  });

  return svgPathData.join(' ');
}

function updateTraces() {
  const svg = document.getElementById('trace-overlay');
  if (!svg) {
    return;
  }

  const renderedPathIds = new Set();

  traceInstances.forEach(({ pathstring, options }, traceId) => {
    const { color = 'blue', strokeWidth = 2 } = options;

    const pathId = `trace-${traceId}`;
    renderedPathIds.add(pathId);

    let path = document.getElementById(pathId);
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', pathId);
      path.setAttribute('fill', 'none');
      path.setAttribute('pointer-events', 'none');
      svg.appendChild(path);
    }

    // TODO: We should parse this in advance.
    const pathAST = parse(pathstring.trim());

    // Convert the AST into the final SVG path string
    // TODO: We should cache parts of this if possible?
    const computedPath = generateSvgPath(pathAST);

    path.setAttribute('d', computedPath.trim());
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeWidth);
  });

    const existingPaths = svg.querySelectorAll('path');
    existingPaths.forEach(path => {
        // TODO: Remove this hack which is in place for testing.
        if (!renderedPathIds.has(path.id) && path.id != 'test_trace_parser') {
            path.remove();
        }
    });
}

// Public functions for module
function addTrace(pathstring, traceId, options = {}) {
  traceInstances.set(traceId, {
    pathstring,
    options,
  });

  updateTraces();
}

function removeTrace(traceId) {
  if (traceInstances.has(traceId)) {
    traceInstances.delete(traceId);
    updateTraces();
  }
}

function clearAllTraces() {
  traceInstances.clear();
  updateTraces();
}
