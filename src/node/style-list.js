/**
 * 可以自动监听 setter 的样式属性列表，默认只包含常用的样式属性
 */
module.exports = [
  'position', 'top', 'bottom', 'right', 'left', 'float', 'clear',
  'display', 'width', 'height', 'max-height', 'max-width', 'min-height', 'min-width', 'flex', 'flex-basis', 'flex-grow', 'flex-shrink', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'order',
  'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top',
  'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top',

  'background', 'background-clip', 'background-color', 'background-image', 'background-origin', 'background-position', 'background-repeat', 'background-size',
  'border', 'border-radius', 'border-bottom-color', 'border-bottom-left-radius', 'border-bottom-right-radius', 'border-bottom-style', 'border-bottom-width', 'border-collapse', 'border-image-outset', 'border-image-repeat', 'border-image-slice', 'border-image-source', 'border-image-width', 'border-left-color', 'border-left-style', 'border-left-width', 'border-right-color', 'border-right-style', 'border-right-width', 'border-top-color', 'border-top-left-radius', 'border-top-right-radius', 'border-top-style', 'border-top-width',
  'border-top', 'border-bottom', 'border-right', 'border-left',
  'outline', 'border-width', 'border-style', 'border-color',

  'animation', 'animation-delay', 'animation-direction', 'animation-duration', 'animation-fill-mode', 'animation-iteration-count', 'animation-name', 'animation-play-state', 'animation-timing-function',
  'transition', 'transition-delay', 'transition-duration', 'transition-property', 'transition-timing-function',
  'transform', 'transform-origin', 'perspective', 'perspective-origin', 'backface-visibility',

  'font', 'font-family', 'font-size', 'font-style', 'font-weight',
  'color', 'text-align', 'text-decoration', 'text-indent', 'text-rendering', 'text-shadow', 'text-overflow', 'text-transform',
  'word-break', 'word-spacing', 'word-wrap', 'line-height', 'letter-spacing', 'white-space', 'user-select',

  'visibility', 'opacity', 'z-index', 'zoom', 'overflow', 'overflow-x', 'overflow-y',
  'box-shadow', 'box-sizing', 'content', 'cursor', 'direction', 'list-style', 'object-fit', 'pointer-events', 'resize', 'vertical-align', 'will-change', 'clip', 'clip-path', 'fill',

  'touch-action', '-webkit-appearance',
];
