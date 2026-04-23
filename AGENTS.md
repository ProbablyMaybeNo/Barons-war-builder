# AGENTS.md

This file defines how coding agents (Codex, Claude Code, etc.) should operate in this repository.

## Core principles

- Be precise and minimal
- Do not over-engineer
- Do not introduce unnecessary dependencies
- Always explain reasoning when making structural decisions

## Workflow rules

1. Read the repo before making changes
2. Prefer modifying existing files over creating new ones
3. Keep commits small and focused
4. Use clear naming and predictable structure

## Data handling

- Game data should live in `/data`
- Prefer JSON or typed schemas
- Do not hardcode rules into UI components

## Code style

- Keep functions small and readable
- Prefer explicit logic over clever shortcuts
- Add comments where rules logic may be unclear

## When unsure

- Ask for clarification OR
- Leave a clear TODO with reasoning

## First tasks for agents

- Define core data schema (units, factions, equipment)
- Create a simple roster structure
- Implement points calculation
- Implement basic validation
