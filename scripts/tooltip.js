export async function showTooltip(event, data) {
  // Remove any existing tooltips first
  $('.mh-tooltip').remove();

  // Render the tooltip content from the Handlebars template using the provided data
  const htmlContent = await renderTemplate("modules/mist-hud/templates/mh-tooltip-theme.hbs", data);
  const tooltip = $(`<div class="mh-tooltip">${htmlContent}</div>`);
  $("body").append(tooltip);

  // Calculate positioning with boundary checks
  const windowWidth = $(window).width();
  const windowHeight = $(window).height();
  const tooltipWidth = tooltip.outerWidth();
  const tooltipHeight = tooltip.outerHeight();

  let top = event.pageY + 16;
  let left = event.pageX + 10;

  // Adjust if tooltip would go off-screen
  if (left + tooltipWidth > windowWidth) {
    left = windowWidth - tooltipWidth - 10;
  }

  if (top + tooltipHeight > windowHeight) {
    top = windowHeight - tooltipHeight - 10;
  }

  tooltip.css({
    top: top,
    left: left,
    position: 'fixed' // Use fixed positioning for more consistent placement
  });

  return tooltip;
}

export function hideTooltip(tooltip) {
  if (tooltip) {
    tooltip.remove();
  }
}
