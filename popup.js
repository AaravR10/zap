// basic stuff
const apiKeyInput = document.getElementById('apiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const keyStatus = document.getElementById('keyStatus');
const resultDiv = document.getElementById('result');
const statusDiv = document.getElementById('status');

// image analysis stuff
const promptInput = document.getElementById('prompt');
const analyzeBtn = document.getElementById('analyzeBtn');
const presetSummarizeBtn = document.getElementById('presetSummarizeBtn');
const presetSolveBtn = document.getElementById('presetSolveBtn');

// code analysis stuff
const fetchCodeBtn = document.getElementById('fetchCodeBtn');
const sourceCodeDisplay = document.getElementById('sourceCodeDisplay');
const codeQueryInput = document.getElementById('codeQuery');
const analyzeCodeBtn = document.getElementById('analyzeCodeBtn');

// tab stuff
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');


const SUMMARIZE_PROMPT = "Based on the visual content of this page, provide a summary of the main information presented";
const SOLVE_PROBLEM_PROMPT = "Analyze the visual content of this page. If there is a question, problem, or puzzle shown, please provide the solution";


let fetchedSourceCode = null;


function setStatus(element, message, type = 'info') { // type can be info, success, error, warning
    element.textContent = message;
    element.className = ''; 
    if (type !== 'info') {
        element.classList.add(type);
    }
}

function clearStatusAndResult() {
    setStatus(statusDiv, '');
    resultDiv.textContent = '';
}

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        // deactivate all buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        clearStatusAndResult();
        analyzeBtn.disabled = false;
        analyzeCodeBtn.disabled = !fetchedSourceCode;
    });
});


document.addEventListener('DOMContentLoaded', () => {
    
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
            setStatus(keyStatus, 'API Key loaded.', 'success');
            setTimeout(() => setStatus(keyStatus, ''), 2000);
        } else {
            setStatus(keyStatus, 'API Key not set.', 'warning');
        }
    });
    
    if (!promptInput.value) {
        promptInput.value = "Describe what you see on the page.";
    }
     analyzeCodeBtn.disabled = true;
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

    clearStatusAndResult();

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

    chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 90 }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
            setStatus(statusDiv, `Error capturing tab: ${chrome.runtime.lastError?.message || 'Unknown error'}`, 'error');
            analyzeBtn.disabled = false;
            return;
        }

        setStatus(statusDiv, 'Sending screenshot to Gemini...');

        chrome.runtime.sendMessage(
            {
                type: "analyzeImage",
                apiKey: apiKey,
                prompt: userPrompt,
                imageDataUrl: dataUrl
            },
            handleApiResponse
        );
    });
});



function getPageSource() {
    return document.documentElement.outerHTML;
}

fetchCodeBtn.addEventListener('click', () => {
    clearStatusAndResult();
    setStatus(statusDiv, 'Fetching source code...');
    fetchCodeBtn.disabled = true;
    analyzeCodeBtn.disabled = true; 
    sourceCodeDisplay.value = ''; 
    fetchedSourceCode = null; 

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
             setStatus(statusDiv, `Error getting active tab: ${chrome.runtime.lastError?.message || 'No active tab?'}`, 'error');
             fetchCodeBtn.disabled = false;
             return;
        }
        const activeTab = tabs[0];

         // ensure that the url is accessible, chrome:// urls won't work
         if (!activeTab.url || !activeTab.url.startsWith('http')) {
              setStatus(statusDiv, 'Cannot fetch source code from this type of page (e.g., chrome://, file://).', 'warning');
              fetchCodeBtn.disabled = false;
              return;
         }


        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: getPageSource
        }, (injectionResults) => {
            fetchCodeBtn.disabled = false;
            if (chrome.runtime.lastError) {
                 setStatus(statusDiv, `Error fetching source: ${chrome.runtime.lastError.message}`, 'error');
                 console.error("Script injection error:", chrome.runtime.lastError);
                 return;
            }
            if (injectionResults && injectionResults[0] && injectionResults[0].result) {
                fetchedSourceCode = injectionResults[0].result;
                sourceCodeDisplay.value = fetchedSourceCode;
                setStatus(statusDiv, 'Source code fetched successfully.', 'success');
                analyzeCodeBtn.disabled = false;
            } else {
                setStatus(statusDiv, 'Failed to fetch source code. Result was empty or unexpected.', 'error');
                console.error("Injection result issue:", injectionResults);
            }
        });
    });
});

analyzeCodeBtn.addEventListener('click', () => {
    const userQuery = codeQueryInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    clearStatusAndResult();

    if (!apiKey) {
        setStatus(statusDiv, 'Error: API Key is missing. Please save it first.', 'error');
        setStatus(keyStatus, 'API Key needed!', 'error');
        return;
    } else {
        setStatus(keyStatus, '');
    }

    if (!fetchedSourceCode) {
        setStatus(statusDiv, 'Error: Source code not fetched yet. Click "Fetch Page Source Code" first.', 'error');
        return;
    }

    if (!userQuery) {
        setStatus(statusDiv, 'Error: Please enter what part of the code you want explained.', 'error');
        return;
    }

    setStatus(statusDiv, 'Sending source code and query to Gemini...');
    analyzeCodeBtn.disabled = true;
    fetchCodeBtn.disabled = true;

    chrome.runtime.sendMessage(
        {
            type: "analyzeCode",
            apiKey: apiKey,
            sourceCode: fetchedSourceCode,
            query: userQuery
        },
        handleApiResponse
    );
});


function handleApiResponse(response) {
     const activeTabId = document.querySelector('.tab-button.active')?.getAttribute('data-tab');
     if (activeTabId === 'imageAnalysisTab') {
         analyzeBtn.disabled = false;
     } else if (activeTabId === 'codeAnalysisTab') {
         analyzeCodeBtn.disabled = false;
         fetchCodeBtn.disabled = false; 
     }


    if (chrome.runtime.lastError) {
        setStatus(statusDiv, `Error communicating with background: ${chrome.runtime.lastError.message}`, 'error');
        console.error("Message passing error:", chrome.runtime.lastError);
    } else if (response) {
        if (response.success) {
            setStatus(statusDiv, 'Response received:', 'success');
            resultDiv.textContent = response.text;
        } else {
            setStatus(statusDiv, 'Error from Gemini API:', 'error');
            resultDiv.textContent = response.error || 'Unknown API error occurred.';
            console.error("API Error:", response.error);
        }
    } else {
        setStatus(statusDiv, 'Error: No response received from background script.', 'error');
        console.error("No response from background script.");
    }
}
