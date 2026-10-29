// Chart colours (validated categorical palette, light + dark steps).
// Charts receive concrete hex values because SVG attributes set by Recharts
// can't reliably read CSS variables in every browser.
export const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

export function chartTheme(mode) {
  const dark = mode === 'dark';
  return {
    series: dark ? SERIES.dark : SERIES.light,
    income: dark ? SERIES.dark[0] : SERIES.light[0],
    expense: dark ? SERIES.dark[1] : SERIES.light[1],
    net: dark ? SERIES.dark[2] : SERIES.light[2],
    grid: dark ? '#26282e' : '#ececef',
    axis: dark ? '#7d818a' : '#7a7d85',
    surface: dark ? '#141519' : '#ffffff',
    muted: dark ? '#3a3d45' : '#d4d5da',
  };
}
