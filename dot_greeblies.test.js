import { describe, it, expect, beforeEach } from 'vitest';
import { drawDotGrid } from './dot_greeblies.js';

describe('drawDotGrid', () => {
  let svgElement;

  beforeEach(() => {
    // Create a mock SVG element in the happy-dom environment
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.style.setProperty('--grid-spacing', '20');
    svgElement.style.setProperty('--dot-radius', '2');
    svgElement.style.setProperty('--dot-color', 'blue');

    // Mock clientWidth and clientHeight
    Object.defineProperty(svgElement, 'clientWidth', { value: 100 });
    Object.defineProperty(svgElement, 'clientHeight', { value: 80 });

    document.body.appendChild(svgElement);
  });

  it('should draw the correct number of dots', () => {
    drawDotGrid(svgElement);
    const circles = svgElement.querySelectorAll('circle');
    // cols = floor(100 / 20) = 5
    // rows = floor(80 / 20) = 4
    // total = 5 * 4 = 20
    expect(circles.length).toBe(20);
  });

  it('should create circles with the correct attributes', () => {
    drawDotGrid(svgElement);
    const firstCircle = svgElement.querySelector('circle');
    expect(firstCircle.getAttribute('r')).toBe('2');
    expect(firstCircle.getAttribute('fill')).toBe('blue');
  });

  it('should clear existing dots before drawing', () => {
    // First draw
    drawDotGrid(svgElement);
    expect(svgElement.querySelectorAll('circle').length).toBe(20);

    // Second draw on the same element
    drawDotGrid(svgElement);
    expect(svgElement.querySelectorAll('circle').length).toBe(20);
  });
});
