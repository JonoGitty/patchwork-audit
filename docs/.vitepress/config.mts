import { defineConfig } from "vitepress";

export default defineConfig({
	title: "Patchwork",
	description: "The audit trail for AI coding agents",
	head: [["link", { rel: "icon", href: "/favicon.ico" }]],
	ignoreDeadLinks: [/localhost/],

	themeConfig: {
		logo: "/logo.svg",
		siteTitle: "Patchwork",

		nav: [
			{ text: "Guide", link: "/getting-started/installation" },
			{ text: "Concepts", link: "/concepts/how-it-works" },
			{ text: "Reference", link: "/reference/cli" },
			{
				text: "v0.6.3",
				items: [
					{
						text: "Changelog",
						link: "https://github.com/JonoGitty/patchwork-audit/releases",
					},
					{
						text: "npm",
						link: "https://www.npmjs.com/package/patchwork-audit",
					},
				],
			},
		],

		sidebar: {
			"/": [
				{
					text: "Getting Started",
					items: [
						{
							text: "Installation",
							link: "/getting-started/installation",
						},
						{ text: "Quickstart", link: "/getting-started/quickstart" },
						{
							text: "Configuration",
							link: "/getting-started/configuration",
						},
					],
				},
				{
					text: "Concepts",
					items: [
						{ text: "How It Works", link: "/concepts/how-it-works" },
						{
							text: "Risk Classification",
							link: "/concepts/risk-classification",
						},
						{
							text: "Tamper-Proof Layers",
							link: "/concepts/tamper-proof-layers",
						},
						{
							text: "Seals & Witnesses",
							link: "/concepts/seals-and-witnesses",
						},
						{ text: "Compliance", link: "/concepts/compliance" },
					],
				},
				{
					text: "Guides",
					items: [
						{ text: "Policy Enforcement", link: "/guides/policy" },
						{ text: "Web Dashboard", link: "/guides/dashboard" },
						{ text: "Session Replay", link: "/guides/replay" },
						{ text: "GitHub Action", link: "/guides/github-action" },
						{ text: "Team Mode", link: "/guides/team-mode" },
					],
				},
				{
					text: "Reference",
					items: [
						{ text: "CLI Commands", link: "/reference/cli" },
						{ text: "Event Schema", link: "/reference/event-schema" },
						{ text: "Policy Schema", link: "/reference/policy-schema" },
						{ text: "Relay Protocol", link: "/reference/relay-protocol" },
					],
				},
				{
					text: "Security",
					items: [
						{ text: "Threat Model", link: "/security/threat-model" },
						{ text: "Architecture", link: "/security/architecture" },
					],
				},
			],
		},

		socialLinks: [
			{
				icon: "github",
				link: "https://github.com/JonoGitty/patchwork-audit",
			},
			{ icon: "npm", link: "https://www.npmjs.com/package/patchwork-audit" },
		],

		search: {
			provider: "local",
		},

		editLink: {
			pattern:
				"https://github.com/JonoGitty/patchwork-audit/edit/main/docs/:path",
			text: "Edit this page on GitHub",
		},

		footer: {
			message: "Released under the BUSL-1.1 License.",
			copyright: "Copyright 2025-present Jono Gompels",
		},
	},
});
