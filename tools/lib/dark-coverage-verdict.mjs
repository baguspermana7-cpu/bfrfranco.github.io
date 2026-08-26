const REQUIRED_CONFIRMATIONS = 2;

function hasFinding(result) {
  return Boolean(result.darkFailure || result.lightFailure || result.renderError);
}

export function resolveRenderCandidate(file, initialResult, confirmations) {
  const reproduced = confirmations.find(hasFinding);
  if (reproduced) return { ...reproduced };

  if (confirmations.length !== REQUIRED_CONFIRMATIONS) {
    return {
      ...initialResult,
      renderError: `${file} render-error=confirmation incomplete (${confirmations.length}/${REQUIRED_CONFIRMATIONS})`
    };
  }

  return { darkFailure: null, lightFailure: null, renderError: null };
}
