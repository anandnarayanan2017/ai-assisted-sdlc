"""LLM access. Every call is a fresh context: the harness's unit of 'context reset'."""
from __future__ import annotations

from typing import Callable, Protocol


class LLM(Protocol):
    def __call__(self, role: str, system: str, user: str) -> str: ...


class AnthropicLLM:
    def __init__(self, model: str = "claude-sonnet-5-5", max_tokens: int = 8000):
        import anthropic  # optional dependency

        self._client = anthropic.Anthropic()
        self.model, self.max_tokens = model, max_tokens

    def __call__(self, role: str, system: str, user: str) -> str:
        r = self._client.messages.create(
            model=self.model, max_tokens=self.max_tokens, system=system,
            messages=[{"role": "user", "content": user}],
        )
        return r.content[0].text


class ScriptedLLM:
    """Deterministic stand-in for tests/offline demos: role -> handler(user) -> str."""

    def __init__(self, handlers: dict[str, Callable[[str], str]]):
        self.handlers, self.calls = handlers, []

    def __call__(self, role: str, system: str, user: str) -> str:
        self.calls.append(role)
        return self.handlers[role](user)
