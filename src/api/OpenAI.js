import axios from 'axios';

export class OpenAI {
    /**
     * Initializes OpenAI client using API key from state.
     */
    constructor(state) {
        this.state = state;

        this.baseUrl = 'https://api.openai.com/v1/';
        this.apiKey = this.state.envData.openaiApiKey;
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    /**
     * Sends input to OpenAI moderation endpoint.
     * @param {string|string[]} input Text or array of texts to moderate.
     * @return {Promise<Object>} OpenAI API moderation response.
     */
    async moderate (input) {
        try {
            const response = await this.client.post('moderations',
                {
                    model: 'omni-moderation-latest',
                    input
                }
            );
            return response.data;
        } catch (error) {
            if (error.status === 401)
                console.log('[OpenAI] Invalid token');
            return { error: 'Failed to moderate content' };
        }
    }

    /**
     * Parses moderation result into friendly boolean flags.
     * @param {Object} result OpenAI moderation API response.
     * @return {Object} Object with boolean flags for each moderation category.
     */
    static parseModerationResult (result) {
        const r = result?.results?.[0] || {};
        const c = r.categories || {};
        return {
            isFlagged: !!r.flagged,
            isSexual: !!c["sexual"],
            isSexualMinors: !!c["sexual/minors"],
            isHarassment: !!c["harassment"],
            isHarassmentThreatening: !!c["harassment/threatening"],
            isHate: !!c["hate"],
            isHateThreatening: !!c["hate/threatening"],
            isIllicit: !!c["illicit"],
            isIllicitViolent: !!c["illicit/violent"],
            isSelfHarm: !!c["self-harm"],
            isSelfHarmIntent: !!c["self-harm/intent"],
            isSelfHarmInstructions: !!c["self-harm/instructions"],
            isViolence: !!c["violence"],
            isViolenceGraphic: !!c["violence/graphic"]
        };
    }
}

