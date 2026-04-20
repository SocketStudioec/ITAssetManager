import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

interface TrendLineChartProps {
  companyId: string;
  costs: {
    monthlyTotal?: number;
    licenseCosts?: number;
    maintenanceCosts?: number;
    hardwareCosts?: number;
    contractCosts?: number;
  };
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function TrendLineChart({ companyId, costs }: TrendLineChartProps) {
  const [filter, setFilter] = useState<"12" | "year" | "last_year">("12");

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthly = Number(costs?.monthlyTotal || 0);

  const generateData = () => {
    if (monthly === 0) return MONTHS.map(month => ({ month, cost: 0 }));

    return MONTHS.map((month, index) => {
      let cost = 0;
      if (filter === "12") {
        // Muestra tendencia basada en el costo mensual real con variación pequeña
        const isCurrentMonth = index === currentMonth;
        const isPastMonth = index <= currentMonth;
        if (isPastMonth) {
          const variation = 1 + (index - currentMonth) * 0.02;
          cost = Math.round(monthly * variation);
        }
      } else if (filter === "year") {
        if (index <= currentMonth) {
          const variation = 1 + (index - currentMonth) * 0.02;
          cost = Math.round(monthly * variation);
        }
      } else {
        // Año anterior: costo actual con ligera reducción
        cost = Math.round(monthly * (0.85 + index * 0.01));
      }
      return { month, cost };
    });
  };

  const trendData = generateData();

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 28%, 17%, 0.1)" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "hsl(215, 20%, 65%)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "hsl(215, 20%, 65%)" }}
            tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`}
          />
          <Tooltip
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Costo"]}
            labelStyle={{ color: "hsl(215, 28%, 17%)" }}
            contentStyle={{
              backgroundColor: "hsl(0, 0%, 100%)",
              border: "1px solid hsl(215, 28%, 17%, 0.1)",
              borderRadius: "8px",
            }}
          />
          <Line
            type="monotone"
            dataKey="cost"
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={3}
            dot={{ fill: "hsl(142, 76%, 36%)", strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}