import * as echarts from 'echarts/core';
import { PieChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, AriaComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([PieChart, BarChart, TooltipComponent, GridComponent, AriaComponent, SVGRenderer]);
export const init = echarts.init;
export const version = echarts.version;
