/** Follow the app's inherited font rather than Plotly's default font. */
export function getPlotlyFontFamily(container: HTMLElement): string {
  return getComputedStyle(container).fontFamily;
}
