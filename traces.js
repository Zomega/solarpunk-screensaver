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
 * TODO: Each modifier can produce a list of things.
 */
function applyModifiers(initialX, initialY, rect, corner, modifiers) {
    let x = initialX;
    let y = initialY;
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;

    modifiers.forEach(mod => {
        // TODO: Handle %? Move this into each type since there may be different arglists?
        const val = mod.value;

        console.log("VAL", val, mod.value);

        switch (mod.type) {
            case 'clip':
                // Moves point INWARD from the edge by 'val'
                if (corner.includes('l')) x += val; // Left sides move right
                if (corner.includes('r')) x -= val; // Right sides move left
                if (corner.includes('t')) y += val; // Top sides move down
                if (corner.includes('b')) y -= val; // Bottom sides move up
                // Sides ('leftside', 'rightside') only adjust one axis
                if (corner === 'leftside') x += val;
                if (corner === 'rightside') x -= val;
                break;

            case 'offset':
                // Moves point OUTWARD from the edge by 'val' (opposite of clip)
                if (corner.includes('l')) x -= val;
                if (corner.includes('r')) x += val;
                if (corner.includes('t')) y -= val;
                if (corner.includes('b')) y += val;
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
                // Used for 'leftside'/'rightside' to specify vertical position,
                // or 'topside'/'bottomside' to specify horizontal position.
                // Assuming it's used on a 'side' corner type.
                if (corner.includes('side')) {
                    // For vertical sides ('leftside', 'rightside'), 'at' specifies the Y position
                    y = rect.top + (height * val);
                } else {
                    // This case is ambiguous but could specify position along an axis for a corner.
                    // We'll ignore 'at' on corner points for now to match common tracing logic.
                }
                break;
        }
    });

    return { x, y };
}


// --- Main Path Generation Logic ---

/**
 * Converts a Path AST (from the parser) into a final SVG path 'd' string.
 * @param {Array} ast - The array of parsed path commands.
 * @returns {string} The final SVG path data.
 */
function generateSvgPath(ast) {
    let svgPathData = [];
    let lastPoint = { x: 0, y: 0 }; // Tracks the last point for H, V, and anonymous (_) points

    /**
     * Resolves an AST coordinate node into a concrete {x, y} point.
     * @param {Object} coord - The coordinate AST node.
     * @returns {{x: number, y: number}} The resolved point.
     */
    const resolveCoordinate = (coord) => {
        if (coord.type === 'anon') {
            // Anonymous point: return the last known point.
            return lastPoint;
        }

        if (coord.type === 'element') {
            const rect = getElementPosition(coord.id);
            if (rect.width === 0 && rect.height === 0) {
                console.warn(`Element #${coord.id} has zero size or is off-screen.`);
                return lastPoint;
            }
            
            // 1. Get the base corner coordinate
            let { x: baseX, y: baseY } = calculateCorner(rect, coord.corner);
            
            // 2. Apply all modifiers (clip, offset, at)
            // TODO: This can actually be a list of points.
            const resolvedPoint = applyModifiers(baseX, baseY, rect, coord.corner, coord.modifiers);
            
            return resolvedPoint;
        }
        
        // Should not happen if grammar is correct
        return lastPoint;
    };

    ast.forEach(commandWrapper => { // Renamed from commandNode for clarity
        // The command object is the first element of the wrapper array: [commandObject, whitespace]
        const commandNode = commandWrapper[0]; 
        
        // Safety check in case the AST structure is slightly different for 'Z' or 'O'
        if (!commandNode || !commandNode.command) {
            console.error("Invalid command node detected:", commandWrapper);
            return;
        }

        const { command } = commandNode; // Now successfully destructures 'M', 'L', 'Z', etc.

        if (command === 'M' || command === 'L') {
            const point = resolveCoordinate(commandNode.coordinate);
            svgPathData.push(`${command} ${point.x},${point.y}`);
            lastPoint = point;

        } else if (command === 'H') {
            const point = resolveCoordinate(commandNode.coordinate);
            svgPathData.push(`${command} ${point.x}`);
            lastPoint = { x: point.x, y: lastPoint.y };

        } else if (command === 'V') {
            const point = resolveCoordinate(commandNode.coordinate);
            svgPathData.push(`${command} ${point.y}`);
            lastPoint = { x: lastPoint.x, y: point.y };

        } else if (command === 'Z') {
            svgPathData.push('Z');
            // lastPoint handling for 'Z' is more complex for standard SVG, 
            // but for simple H/V tracking, leaving it as is is fine.
            // TODO: Implement

        } else if (command === 'O') {
            const { id } = commandNode.element;
            console.log(`Custom command 'O' detected for element #${id}.`);
            // TODO: Implement
        }
    });

    return svgPathData.join(' ');
}

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