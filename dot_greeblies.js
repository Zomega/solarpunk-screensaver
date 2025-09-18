/**
 * Draws a dot grid inside the given SVG element based on a CSS variable for spacing.
 */
function drawDotGrid(dotGridSVG) {
    // Clear any existing circles to prevent stacking on resize
    dotGridSVG.innerHTML = '';

    // Get CSS variable values from the element's computed style
    const style = getComputedStyle(dotGridSVG);
    const spacing = parseFloat(style.getPropertyValue('--grid-spacing'));
    const radius = parseFloat(style.getPropertyValue('--dot-radius'));
    const color = style.getPropertyValue('--dot-color');

    // Get the current dimensions of the SVG container
    const svgWidth = dotGridSVG.clientWidth;
    const svgHeight = dotGridSVG.clientHeight;

    // TODO: Account for minimum Interior padding?
    // TODO: Allow speifying cols / rows manually.

    // Calculate the number of rows and columns based on the spacing
    const cols = Math.floor(svgWidth / spacing);
    const rows = Math.floor(svgHeight / spacing);

    // Calculate the adjusted spacing to center the grid
    const xOffset = (svgWidth - (cols - 1) * spacing) / 2;
    const yOffset = (svgHeight - (rows - 1) * spacing) / 2;

    // Create and append circles for each dot in the grid
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            
            // Calculate position based on spacing and offset
            circle.setAttribute("cx", xOffset + c * spacing);
            circle.setAttribute("cy", yOffset + r * spacing);
            circle.setAttribute("r", radius);
            circle.setAttribute("fill", color);

            dotGridSVG.appendChild(circle);
        }
    }
}

export {
    drawDotGrid,
};