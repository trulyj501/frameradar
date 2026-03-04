import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

interface RadarSignalsChartProps {
  values: {
    emotional_heat: number;
    moral_outrage: number;
    black_white: number;
    us_them: number;
    fight_picking: number;
  };
}

const SIGNAL_LABELS: Array<{ key: keyof RadarSignalsChartProps["values"]; label: string }> = [
  { key: "emotional_heat", label: "감정적 과열" },
  { key: "moral_outrage", label: "도덕적 분노" },
  { key: "black_white", label: "흑백 논리" },
  { key: "us_them", label: "우리 대 그들" },
  { key: "fight_picking", label: "갈등 유도" }
];

export const RadarSignalsChart = ({ values }: RadarSignalsChartProps) => {
  const data = SIGNAL_LABELS.map((signal) => ({
    subject: signal.label,
    score: values[signal.key]
  }));

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 20, right: 12, bottom: 10, left: 12 }}>
          <PolarGrid stroke="#b3bcc7" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#243042", fontSize: 13 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#607086", fontSize: 11 }} />
          <Radar
            name="신호 강도"
            dataKey="score"
            stroke="#D95F39"
            fill="#D95F39"
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
