chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "analyzeImage") {
      if (!request.apiKey || !request.prompt || !request.imageDataUrl) {
          console.error("Missing data in request:", request);
          sendResponse({ success: false, error: "Missing API Key, Prompt, or Image Data." });
          return true;
      }
  
      const apiKey = request.apiKey;
      const userPrompt = request.prompt;
      const imageDataUrl = request.imageDataUrl;
  
      const match = imageDataUrl.match(/^data:(image\/(jpeg|png));base64,(.*)$/);
      if (!match) {
          console.error("Invalid image data URL format");
          sendResponse({ success: false, error: "Invalid image data format." });
          return true;
      }
      const mimeType = match[1];
      const base64Data = match[3];
  
  
      // Call Gemini API
      callGeminiVisionApi(apiKey, userPrompt, base64Data, mimeType)
        .then(textResponse => {
          sendResponse({ success: true, text: textResponse });
        })
        .catch(error => {
          console.error("Gemini API call failed:", error);
          sendResponse({ success: false, error: error.message || "Unknown API error" });
        });
  
      return true; // sendReponse will be called asynchronously
    }
     return false;
  });
  
  
  async function callGeminiVisionApi(apiKey, prompt, base64ImageData, mimeType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
  
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
          return `Request blocked by API: ${data.promptFeedback.blockReason}` +
                 (data.promptFeedback.safetyRatings ? `\nDetails: ${JSON.stringify(data.promptFeedback.safetyRatings)}` : '');
      }
       else {
        console.warn("Couldn't extract text from Gemini response structure:", data);
        return "Couldn't find text in the API response. Check console for details.";
      }
  
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw error;
    }
  }
  
  console.log("Gemini Vision background script loaded.");