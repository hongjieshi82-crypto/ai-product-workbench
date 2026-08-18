# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only

import os
from unittest.mock import MagicMock, patch

import pytest

from plane.app.views.external.base import (
    DeepSeekProvider,
    SUPPORTED_PROVIDERS,
    get_llm_config,
    get_llm_response,
)


@pytest.mark.unit
def test_deepseek_provider_is_available():
    assert SUPPORTED_PROVIDERS["deepseek"] is DeepSeekProvider
    assert DeepSeekProvider.default_model == "deepseek-v4-flash"


@pytest.mark.unit
@patch(
    "plane.app.views.external.base.get_configuration_value",
    return_value=("stored-key", "openai", "gpt-4o-mini"),
)
def test_local_environment_overrides_stored_llm_configuration(_mock_configuration):
    with patch.dict(
        os.environ,
        {
            "LLM_API_KEY": "local-key",
            "LLM_PROVIDER": "deepseek",
            "LLM_MODEL": "deepseek-v4-flash",
        },
    ):
        assert get_llm_config() == ("local-key", "deepseek-v4-flash", "deepseek")


@pytest.mark.unit
@patch("plane.app.views.external.base.OpenAI")
def test_deepseek_uses_its_compatible_api_endpoint(mock_openai):
    completion = MagicMock()
    completion.choices[0].message.content = '{"table_key":"requirements"}'
    mock_openai.return_value.chat.completions.create.return_value = completion

    text, error = get_llm_response(
        "整理需求",
        "增加日期筛选",
        "test-key",
        "deepseek-v4-flash",
        "deepseek",
    )

    mock_openai.assert_called_once_with(api_key="test-key", base_url="https://api.deepseek.com")
    mock_openai.return_value.chat.completions.create.assert_called_once_with(
        model="deepseek-v4-flash",
        messages=[{"role": "user", "content": "整理需求\n增加日期筛选"}],
    )
    assert text == '{"table_key":"requirements"}'
    assert error is None
