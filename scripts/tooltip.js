export async function showTooltip(event, data) {
  // Render the tooltip content from the Handlebars template using the provided data
  const htmlContent = await renderTemplate("modules/mist-hud/templates/mh-tooltip-theme.hbs", data);
  const tooltip = $(`<div class="mh-tooltip">${htmlContent}</div>`);
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
