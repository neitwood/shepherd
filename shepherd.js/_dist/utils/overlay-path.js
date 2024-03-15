/*! shepherd.js 12.0.0-alpha.3 */

/**
 * Generates the svg path data for a rounded rectangle overlay
 * @param dimension - Dimensions of rectangle.
 * @param dimension.width - Width.
 * @param dimension.height - Height.
 * @param dimension.x - Offset from top left corner in x axis. default 0.
 * @param dimension.y - Offset from top left corner in y axis. default 0.
 * @param dimension.r - Corner Radius. Keep this smaller than half of width or height.
 * @returns Rounded rectangle overlay path data.
 */
function makeOverlayPath({ width, height, x = 0, y = 0, r = 0 }) {
    const { innerWidth: w, innerHeight: h } = window;
    const { topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0 } = typeof r === 'number'
        ? { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r }
        : r;
    return `M${w},${h}\
H0\
V0\
H${w}\
V${h}\
Z\
M${x + topLeft},${y}\
a${topLeft},${topLeft},0,0,0-${topLeft},${topLeft}\
V${height + y - bottomLeft}\
a${bottomLeft},${bottomLeft},0,0,0,${bottomLeft},${bottomLeft}\
H${width + x - bottomRight}\
a${bottomRight},${bottomRight},0,0,0,${bottomRight}-${bottomRight}\
V${y + topRight}\
a${topRight},${topRight},0,0,0-${topRight}-${topRight}\
Z`;
}

export { makeOverlayPath };
//# sourceMappingURL=overlay-path.js.map