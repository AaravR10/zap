const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const keyStatus = document.getElementById('keyStatus');
const promptInput = document.getElementById('prompt');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultDiv = document.getElementById('result');
const statusDiv = document.getElementById('status');
const presetSummarizeBtn = document.getElementById('presetSummarizeBtn');
const presetSolveBtn = document.getElementById('presetSolveBtn');

const SUMMARIZE_PROMPT = "Based on the visual content of this page, provide a summary of the main information presented";
const SOLVE_PROBLEM_PROMPT = "Analyze the visual content of this page. If there is a question, problem, or puzzle shown, please provide the solution";

function setStatus(element, message, type = 'info') { // type can be info, success, error, warning
    element.textContent = message;
    element.className = '';
    if (type !== 'info') {
        element.classList.add(type);
    }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      setStatus(keyStatus, 'API Key loaded.', 'success');
       setTimeout(() => setStatus(keyStatus,''), 2000);
    } else {
       setStatus(keyStatus, 'API Key not set.', 'warning');
    }
  });
   if (!promptInput.value) {
     promptInput.value = "Describe what you see on the page.";
   }
});

saveApiKeyBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      console.log('API Key saved.');
      setStatus(keyStatus, 'API Key Saved!', 'success');
      setTimeout(() => setStatus(keyStatus, ''), 2000);
    });
  } else {
     setStatus(keyStatus, 'Please enter an API Key.', 'error');
  }
});

presetSummarizeBtn.addEventListener('click', () => {
    promptInput.value = SUMMARIZE_PROMPT;
});

presetSolveBtn.addEventListener('click', () => {
    promptInput.value = SOLVE_PROBLEM_PROMPT;
});


analyzeBtn.addEventListener('click', () => {
  const userPrompt = promptInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  setStatus(statusDiv, '');
  resultDiv.textContent = '';


  if (!apiKey) {
    setStatus(statusDiv, 'Error: API Key is missing. Please save it first.', 'error');
    setStatus(keyStatus, 'API Key needed!', 'error');
    return;
  } else {
     setStatus(keyStatus, '');
  }


   if (!userPrompt) {
    setStatus(statusDiv, 'Error: Please enter or select a request.', 'error');
    return;
  }


  setStatus(statusDiv, 'Capturing screenshot...');
  analyzeBtn.disabled = true;

  // 1. Capture the tab on screen at the moment
  chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 90 }, (dataUrl) => {
    if (chrome.runtime.lastError || !dataUrl) {
        setStatus(statusDiv, `Error capturing tab: ${chrome.runtime.lastError?.message || 'Unknown error'}`, 'error');
        analyzeBtn.disabled = false;
        return;
    }

    setStatus(statusDiv, 'Sending screenshot to Gemini...');

    // 2. Call API with the screenshot and user prompt
    chrome.runtime.sendMessage(
      {
        type: "analyzeImage",
        apiKey: apiKey,
        prompt: userPrompt,
        imageDataUrl: dataUrl
      },
      (response) => {
        analyzeBtn.disabled = false;
        if (chrome.runtime.lastError) {
             setStatus(statusDiv, `Error communicating with background: ${chrome.runtime.lastError.message}`, 'error');
             console.error("Message passing error:", chrome.runtime.lastError);
        } else if (response) {
          if (response.success) {
            setStatus(statusDiv, 'Response received:', 'success');
            resultDiv.textContent = response.text;
          } else {
            setStatus(statusDiv, 'Error from Gemini API:', 'error');
            resultDiv.textContent = response.error;
             console.error("API Error:", response.error);
          }
        } else {
             setStatus(statusDiv, 'Error: No response received from background script.', 'error');
             console.error("No response from background script.");
        }
      }
    );
  });
});