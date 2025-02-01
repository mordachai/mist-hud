export function showTooltip(event, content) {
    const tooltip = $(`<div class="mh-tooltip">${content}</div>`);
    $("body").append(tooltip);
    tooltip.css({
      top: event.pageY + 10,
      left: event.pageX + 10
    });
    return tooltip;
  }
  
  export function hideTooltip(tooltip) {
    tooltip.remove();
  }