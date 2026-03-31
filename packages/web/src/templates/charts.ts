import type { RiskTimelinePoint } from "../data/queries.js";

export function activityBarChart(byDay: Record<string, number>, id = "activityChart"): string {
	const sorted = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
	const labels = JSON.stringify(sorted.map(([d]) => d.slice(5)));
	const data = JSON.stringify(sorted.map(([, c]) => c));
	return `<div class="chart-container">
		<canvas id="${id}"></canvas>
	</div>
	<script>
	new Chart(document.getElementById('${id}'), {
		type: 'bar',
		data: {
			labels: ${labels},
			datasets: [{
				label: 'Events',
				data: ${data},
				backgroundColor: 'rgba(88,166,255,0.6)',
				borderRadius: 4,
			}]
		},
		options: {
			responsive: true, maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
				y: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' }, beginAtZero: true }
			}
		}
	});
	</script>`;
}

export function riskDonutChart(byRisk: Record<string, number>, id = "riskDonut"): string {
	const order = ["critical", "high", "medium", "low", "none"];
	const colors = ["#f85149", "#d29922", "#e3b341", "#8b949e", "#484f58"];
	const labels = JSON.stringify(order.filter(r => byRisk[r]));
	const data = JSON.stringify(order.filter(r => byRisk[r]).map(r => byRisk[r]));
	const bg = JSON.stringify(order.filter(r => byRisk[r]).map((_, i) => colors[order.indexOf(order.filter(r => byRisk[r])[i])]));

	const filteredOrder = order.filter(r => byRisk[r]);
	const filteredColors = filteredOrder.map(r => colors[order.indexOf(r)]);

	return `<div class="chart-container">
		<canvas id="${id}"></canvas>
	</div>
	<script>
	new Chart(document.getElementById('${id}'), {
		type: 'doughnut',
		data: {
			labels: ${JSON.stringify(filteredOrder)},
			datasets: [{
				data: ${JSON.stringify(filteredOrder.map(r => byRisk[r]))},
				backgroundColor: ${JSON.stringify(filteredColors)},
				borderWidth: 0,
			}]
		},
		options: {
			responsive: true, maintainAspectRatio: false,
			plugins: {
				legend: { position: 'bottom', labels: { color: '#8b949e', padding: 16 } }
			},
			cutout: '65%',
		}
	});
	</script>`;
}

export function riskTimelineChart(points: RiskTimelinePoint[], id = "riskTimeline"): string {
	const labels = JSON.stringify(points.map(p => p.date.slice(5)));
	return `<div class="chart-container">
		<canvas id="${id}"></canvas>
	</div>
	<script>
	new Chart(document.getElementById('${id}'), {
		type: 'line',
		data: {
			labels: ${labels},
			datasets: [
				{ label: 'Critical', data: ${JSON.stringify(points.map(p => p.critical))}, borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.1)', fill: true, tension: 0.3 },
				{ label: 'High', data: ${JSON.stringify(points.map(p => p.high))}, borderColor: '#d29922', backgroundColor: 'rgba(210,153,34,0.1)', fill: true, tension: 0.3 },
				{ label: 'Medium', data: ${JSON.stringify(points.map(p => p.medium))}, borderColor: '#e3b341', backgroundColor: 'rgba(227,179,65,0.1)', fill: true, tension: 0.3 },
				{ label: 'Low', data: ${JSON.stringify(points.map(p => p.low))}, borderColor: '#8b949e', backgroundColor: 'rgba(139,148,158,0.05)', fill: true, tension: 0.3 },
			]
		},
		options: {
			responsive: true, maintainAspectRatio: false,
			plugins: { legend: { position: 'bottom', labels: { color: '#8b949e' } } },
			scales: {
				x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
				y: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' }, beginAtZero: true, stacked: true }
			}
		}
	});
	</script>`;
}

export function horizontalBarChart(data: Array<[string, number]>, id: string, color = "#58a6ff"): string {
	if (data.length === 0) return `<div class="empty">No data.</div>`;
	return `<div class="chart-container">
		<canvas id="${id}"></canvas>
	</div>
	<script>
	new Chart(document.getElementById('${id}'), {
		type: 'bar',
		data: {
			labels: ${JSON.stringify(data.map(([l]) => l.length > 30 ? l.slice(0, 30) + '...' : l))},
			datasets: [{ data: ${JSON.stringify(data.map(([, v]) => v))}, backgroundColor: '${color}', borderRadius: 4 }]
		},
		options: {
			indexAxis: 'y',
			responsive: true, maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' }, beginAtZero: true },
				y: { grid: { display: false }, ticks: { color: '#8b949e', font: { family: 'monospace', size: 12 } } }
			}
		}
	});
	</script>`;
}
