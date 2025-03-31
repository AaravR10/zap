chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "analyzeImage") {
    if (!request.apiKey || !request.prompt || !request.imageDataUrl) {
        console.error("Missing data in analyzeImage request:", request);
        sendResponse({ success: false, error: "Missing API Key, Prompt, or Image Data." });
        return true;
    }

    const match = request.imageDataUrl.match(/^data:(image\/(jpeg|png));base64,(.*)$/);
    if (!match) {
        console.error("Invalid image data URL format");
        sendResponse({ success: false, error: "Invalid image data format." });
        return true;
    }
    const mimeType = match[1];
    const base64Data = match[3];

    callGeminiVisionApi(request.apiKey, request.prompt, base64Data, mimeType)
      .then(textResponse => sendResponse({ success: true, text: textResponse }))
      .catch(error => {
        console.error("Gemini Vision API call failed:", error);
        sendResponse({ success: false, error: error.message || "Unknown Vision API error" });
      });

    return true;

  } else if (request.type === "analyzeCode") {
      if (!request.apiKey || !request.sourceCode || !request.query) {
          console.error("Missing data in analyzeCode request:", request);
          sendResponse({ success: false, error: "Missing API Key, Source Code, or Query." });
          return true;
      }

      const combinedPrompt = `You are an expert code analysis assistant.
Analyze the following HTML/CSS/JavaScript source code and specifically explain the part requested by the user.

User Query: "${request.query}"

Source Code:
\`\`\`html
${request.sourceCode}
\`\`\`

Provide a clear and concise explanation focused on the user's query based on the provided source code.`;

      callGeminiTextApi(request.apiKey, combinedPrompt)
          .then(textResponse => sendResponse({ success: true, text: textResponse }))
          .catch(error => {
              console.error("Gemini Text API call failed:", error);
              sendResponse({ success: false, error: error.message || "Unknown Text API error" });
          });

      return true;
  }

  console.log("Unrecognized message type received:", request.type);
  return false;
});



async function callGeminiApi(apiKey, requestBody) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;

  try {
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
          let errorBody = null;
          try {
              errorBody = await response.json();
              console.error("Gemini API Error Response:", errorBody);
          } catch (parseError) {
              console.error("Could not parse error response body");
          }
          const errorMessage = errorBody?.error?.message || `HTTP error! status: ${response.status} ${response.statusText}`;
          throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Gemini API Success Response:", data);

      if (data.candidates && data.candidates.length > 0 &&
          data.candidates[0].content && data.candidates[0].content.parts &&
          data.candidates[0].content.parts.length > 0 &&
          data.candidates[0].content.parts[0].text) {
          return data.candidates[0].content.parts[0].text;
      } else if (data.promptFeedback && data.promptFeedback.blockReason) {
           const blockMessage = `Request blocked by API: ${data.promptFeedback.blockReason}` +
               (data.promptFeedback.safetyRatings ? `\nDetails: ${JSON.stringify(data.promptFeedback.safetyRatings)}` : '');
           console.warn("Gemini block reason:", blockMessage);
           return blockMessage;
      }
       else {
          console.warn("Couldn't extract text from Gemini response structure:", data);
          if(data.candidates && data.candidates[0].finishReason && data.candidates[0].finishReason !== "STOP") {
               return `Analysis stopped due to: ${data.candidates[0].finishReason}. This might be due to safety settings or token limits.`
          }
          return "Couldn't find text in the API response. Check the background script console for details.";
      }

  } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
  }
}

async function callGeminiVisionApi(apiKey, prompt, base64ImageData, mimeType) {
  const requestBody = {
      contents: [
          {
              parts: [
                  { text: prompt },
                  {
                      inline_data: {
                          mime_type: mimeType,
                          data: base64ImageData
                      }
                  }
              ]
          }
      ],
  };
  return callGeminiApi(apiKey, requestBody);
}


async function callGeminiTextApi(apiKey, combinedPrompt) {
  const requestBody = {
      contents: [
          {
              parts: [
                  { text: combinedPrompt }
              ]
          }
      ],
  };
  return callGeminiApi(apiKey, requestBody);
}


console.log("ZAP background script loaded");
