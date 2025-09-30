const borderInstances = new Map();
const resizeObserver = new ResizeObserver(updateBorders);
resizeObserver.observe(document.body);
window.addEventListener('scroll', updateBorders);

// Export the public functions
export {
    addBorder,
    removeBorder,
    clearAllBorders,
    getElementPosition
};

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

function updateBorders() {
    const svg = document.getElementById('trace-overlay');
    if (!svg) {
        return;
    }

    const renderedPathIds = new Set();

    borderInstances.forEach(({ elementIds, options }, borderId) => {
        const { offset = 0, chamferSize = 0, color = 'blue', strokeWidth = 2 } = options;
        
        elementIds.forEach(elementId => {
            const pathId = `border-${borderId}-${elementId}`;
            renderedPathIds.add(pathId);
            
            const element = document.getElementById(elementId);
            if (!element) {
                return;
            }

            let path = document.getElementById(pathId);
            if (!path) {
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('id', pathId);
                path.setAttribute('fill', 'none');
                path.setAttribute('pointer-events', 'none');
                svg.appendChild(path);
            }

            const rect = element.getBoundingClientRect();
            const x1 = rect.left - offset;
            const y1 = rect.top - offset;
            const x2 = rect.right + offset;
            const y2 = rect.bottom + offset;
            const maxChamfer = Math.min(rect.width, rect.height) / 2;
            const effectiveChamfer = Math.min(chamferSize, maxChamfer);

            let pathData;
            if (effectiveChamfer === 0) {
                pathData = `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z`;
            } else {
                pathData = `
                    M ${x1 + effectiveChamfer},${y1}
                    L ${x2 - effectiveChamfer},${y1}
                    L ${x2},${y1 + effectiveChamfer}
                    L ${x2},${y2 - effectiveChamfer}
                    L ${x2 - effectiveChamfer},${y2}
                    L ${x1 + effectiveChamfer},${y2}
                    L ${x1},${y2 - effectiveChamfer}
                    L ${x1},${y1 + effectiveChamfer}
                    Z
                `;
            }

            path.setAttribute('d', pathData.trim());
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-width', strokeWidth);
        });
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
function addBorder(borderId, elementIds, options = {}) {
    if (!Array.isArray(elementIds) || elementIds.length === 0) {
        console.error('`elementIds` must be a non-empty array.');
        return;
    }

    borderInstances.set(borderId, {
        elementIds,
        options
    });

    updateBorders();
}

function removeBorder(borderId) {
    if (borderInstances.has(borderId)) {
        borderInstances.delete(borderId);
        updateBorders();
    }
}

function clearAllBorders() {
    borderInstances.clear();
    updateBorders();
}