import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// Interfaz actualizada para incluir applicationCosts separado de hardwareCosts
interface CostPieChartProps {
  data: {
    licenseCosts?: number;
    maintenanceCosts?: number;
    hardwareCosts?: number;
    applicationCosts?: number;
    contractCosts?: number;
  };
  loading?: boolean;
}

// Colores para cada categoría del gráfico
const COLORS = [
  "hsl(214, 80%, 55%)",  // Licencias - azul
  "hsl(142, 76%, 36%)",  // Mantenimiento - verde
  "hsl(38, 92%, 50%)",   // Hardware - naranja
  "hsl(0, 84%, 60%)",    // Contratos - rojo
  "hsl(270, 70%, 60%)",  // Aplicaciones - morado
];

export default function CostPieChart({ data, loading }: CostPieChartProps) {
  if (loading) {
    return (
      <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  // Construcción del chartData incluyendo Aplicaciones como categoría separada
  const chartData = [
    { name: "Licencias", value: Number(data.licenseCosts || 0), color: COLORS[0] },
    { name: "Mantenimiento", value: Number(data.maintenanceCosts || 0), color: COLORS[1] },
    { name: "Hardware", value: Number(data.hardwareCosts || 0), color: COLORS[2] },
    { name: "Contratos", value: Number(data.contractCosts || 0), color: COLORS[3] },
    { name: "Aplicaciones", value: Number(data.applicationCosts || 0), color: COLORS[4] },
  ].filter(item => item.value > 0);

  if (chartData.length === 0) {
    return (
      <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No hay datos de costos disponibles</p>
        </div>
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
            labelStyle={{ color: "hsl(215, 28%, 17%)" }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Desglose de costos por categoría */}
      <div className="mt-4 space-y-2 text-sm">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center justify-between" data-testid={`cost-breakdown-${item.name.toLowerCase()}`}>
            <span className="flex items-center">
              <span
                className="w-3 h-3 rounded mr-2"
                style={{ backgroundColor: item.color }}
              ></span>
              {item.name}
            </span>
            <span className="font-medium">
              ${item.value.toLocaleString()} ({((item.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}