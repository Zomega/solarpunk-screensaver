import { parse } from './trace_grammar.js';

// TODO: Combine and integrate with borders.
import { getElementPosition } from './borders.js'; // Use this line if borders.js exports it


// Export the public functions
export {
    test_trace_parser
};


/**
 * Calculates the starting {x, y} point for a given corner string on a rect.
 * This is based on standard SVG/DOM coordinates.
 */
function calculateCorner(rect, corner) {
    switch (corner) {
        case 'tl': return { x: rect.left, y: rect.top };
        case 'tr': return { x: rect.right, y: rect.top };
        case 'bl': return { x: rect.left, y: rect.bottom };
        case 'br': return { x: rect.right, y: rect.bottom };
        case 'leftside': return { x: rect.left, y: rect.top + rect.height / 2 };
        case 'rightside': return { x: rect.right, y: rect.top + rect.height / 2 };
        // Add top/bottom side centers if needed
        default: return { x: rect.left, y: rect.top };
    }
}


/**
 * Applies all modifiers to the base {x, y} coordinate.
 *
 * @param {number} initialX - The base X coordinate (from calculateCorner).
 * @param {number} initialY - The base Y coordinate (from calculateCorner).
 * @param {Object} rect - The element's bounding rectangle (e.g., {left, top, right, bottom}).
 * @param {string} corner - The corner type (e.g., 'tl', 'tr', 'leftside').
 * @param {Array<Object>|undefined} modifiers - An array of modifier nodes, or undefined.
 * @returns {{x: number, y: number}} The resolved point.
 */
function applyModifiers(initialX, initialY, rect, corner, modifiers) {
    // FIX: Guard clause to handle undefined or non-array 'modifiers'
    if (!modifiers || !Array.isArray(modifiers)) {
        return { x: initialX, y: initialY };
    }

    let x = initialX;
    let y = initialY;
    
    // Calculate width and height from the rect for use in '%' calculations (or 'at')
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;

    // console.log(modifiers); // Retain or remove debugging logs as needed

    modifiers.forEach(mod => {
        // Assume 'mod.value' is already a number, potentially resolving percentages elsewhere.
        // If 'val' is NaN due to missing mod.value, the arithmetic will handle it.
        const val = mod.value; 

        // console.log("VAL", val, mod.value); // Retain or remove debugging logs as needed

        switch (mod.type) {
            case 'clip':
                // Moves point INWARD from the element edge by 'val'
                if (corner.includes('l')) x += val; // Left sides move right
                if (corner.includes('r')) x -= val; // Right sides move left
                if (corner.includes('t')) y += val; // Top sides move down
                if (corner.includes('b')) y -= val; // Bottom sides move up
                
                // Side corners only adjust one axis
                if (corner === 'leftside') x += val;
                if (corner === 'rightside') x -= val;
                // 'topside' and 'bottomside' are missing from original logic, but would adjust Y
                break;

            case 'offset':
                // Moves point OUTWARD from the element edge by 'val' (opposite of clip)
                if (corner.includes('l')) x -= val;
                if (corner.includes('r')) x += val;
                if (corner.includes('t')) y -= val;
                if (corner.includes('b')) y += val;
                
                // Side corners
                if (corner === 'leftside') x -= val;
                if (corner === 'rightside') x += val;
                break;
                
            case 'offsetx':
                // Explicit horizontal adjustment
                x += val;
                break;

            case 'offsety':
                // Explicit vertical adjustment
                y += val;
                break;
                
            case 'at':
                // Used for 'side' corners to specify position along the side.
                // 'val' is assumed to be a ratio (0.0 to 1.0) or percentage (0 to 100, if not resolved).
                if (corner.includes('side')) {
                    // For vertical sides ('leftside', 'rightside'), 'at' specifies the Y position
                    // Assume 'val' is 0 to 1 for fractional position.
                    y = rect.top + (height * val);
                } 
                // Note: Horizontal sides ('topside', 'bottomside') would use width for X.
                // Ignoring 'at' on corner points.
                break;
        }
    });

    return { x, y };
}


// Resolves an AST coordinate node into a concrete {x, y} point.
// TODO: These really should return an ordered list of points.
function resolveCoordinate(coord) {
    if (coord.type === 'anon') {
        // Anonymous point: return the last known point.
        return lastPoint;
    }

    if (coord.type === 'element') {
        const rect = getElementPosition(coord.id);
        if (rect.width === 0 && rect.height === 0) {
            console.warn(`Element #${coord.id} has zero size or is off-screen. Returning last point.`);
            return lastPoint;
        }
        
        // 1. Get the base corner coordinate
        let { x: baseX, y: baseY } = calculateCorner(rect, coord.corner);
        
        // 2. Apply all modifiers (clip, offset, at)
        // The applyModifiers is assumed to return a single point {x, y} for this context.
        const resolvedPoint = applyModifiers(baseX, baseY, rect, coord.corner, coord.modifiers);
        
        return resolvedPoint;
    }
    
    // Should not happen if grammar is correct
    console.warn(`Unknown coordinate type '${coord.type}'. Returning last point.`);
    return lastPoint;
};

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
        console.error("Input AST is not a valid array and cannot be processed.", ast);
        return svgPathData.join(' '); // Return an empty path string
    }

    ast.forEach(commandWrapper => {
        // The command object is the first element of the wrapper array: [commandObject, whitespace]
        const commandNode = commandWrapper[0]; 
        
        // Safety check
        if (!commandNode || !commandNode.command) {
            console.error("Invalid command node detected:", commandWrapper);
            return;
        }

        const { command } = commandNode;

        if (command === 'M' || command === 'L') {
            const point = resolveCoordinate(commandNode.coordinate);
            svgPathData.push(`${command} ${point.x},${point.y}`);
            // Global/scoped lastPoint must be updated outside the function or passed by reference if strict scoping is used
            // For this implementation, we assume `lastPoint` is mutable and scoped.
            lastPoint = { x: point.x, y: point.y }; 

        } else if (command === 'H') {
            // The 'assert' becomes a runtime check
            if (!lastPoint) { console.error("H command requires a previous point."); return; }

            const point = resolveCoordinate(commandNode.coordinate);
            svgPathData.push(`${command} ${point.x}`);
            lastPoint.x = point.x;
            // Y is unchanged

        } else if (command === 'V') {
            if (!lastPoint) { console.error("V command requires a previous point."); return; }

            const point = resolveCoordinate(commandNode.coordinate);
            svgPathData.push(`${command} ${point.y}`);
            lastPoint.y = point.y;
            // X is unchanged

        } else if (command === 'Z') {
            svgPathData.push('Z');
            // In standard SVG, 'Z' implicitly closes the subpath, moving the current point
            // to the starting point of the current subpath. For simplicity here, we leave
            // the lastPoint update as a TODO, as the original suggested.
            // TODO: Update lastPoint to the starting point of the current subpath.
            // TODO: Assert no following command.

        } else if (command === 'O') {
            const { id } = commandNode.element;
            if (lastPoint) { console.error("O command requires no previous point exists."); return; }

            // The original logic seems to use 'O' to draw a path *around* the element's four corners.
            // This is a custom command, so its interpretation is based on the pseudocode.
            
            // The array of corners to resolve
            const corners = ['tl', 'tr', 'br', 'bl']; // Added 'bl' and changed order for a standard rectangle path
            
            // The starting point (MoveTo)
            const firstPoint = resolveCoordinate({
                'type': "element",
                id: id,
                corner: corners[0],
                modifiers: commandNode.element.modifiers,
            });
            svgPathData.push(`M ${firstPoint.x},${firstPoint.y}`);
            
            // LineTo the remaining corners
            for (let i = 1; i < corners.length; i++) {
                const corner = corners[i];
                console.log(commandNode);
                const point = resolveCoordinate({
                    'type': "element",
                    id: id,
                    corner: corner,
                    modifiers: commandNode.element.modifiers,
                });
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
};

function test_trace_parser() {

    const color = 'blue';
    const strokeWidth = 2;

    const svg = document.getElementById('trace-overlay');
    const pathId = `test_trace_parser`;

    const pathString = `
    M #mainframe.tr
    L #mainframe.tl.clip(20)
    L #mainframe.bl.clip(4)
    L #statusbox.br
    L #bl-graph.br
    `;

    /*const pathString = `
    O #mainframe.tl.clip(20)
    `;*/

    try {
        const pathAST = parse(pathString.trim());
        console.log("Parsed AST (Mock):", pathAST);
        
        // Convert the AST into the final SVG path string
        const finalPathD = generateSvgPath(pathAST);

        let path = document.getElementById(pathId);
        if (!path) {
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('id', pathId);
            path.setAttribute('fill', 'none');
            path.setAttribute('pointer-events', 'none');
            svg.appendChild(path);
        }
        
        // Now you can apply this to your SVG path element
        // document.getElementById('my-svg-path').setAttribute('d', finalPathD);
        console.log("SVG d attribute value:", finalPathD);

        path.setAttribute('d', finalPathD.trim());
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', strokeWidth);
        console.log(path);

    } catch (error) {
        console.error("Parsing Error:", error.message);
    }
}