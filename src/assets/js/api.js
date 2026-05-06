const SUPABASE_URL = 'https://yerfywpkeqlduwwnmkqo.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcmZ5d3BrZXFsZHV3d25ta3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MDQ4OTUsImV4cCI6MjA5MzE4MDg5NX0.VJV-DEq6QYHwMb3pQIghNgpc3_VlSBTjUCbsTGL6ilo';

const supabaseHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const SupabaseAPI = {
    /**
     * Lakukan GET request
     * @param {string} endpoint - Nama tabel (contoh: 'users')
     * @param {object} params - Query params opsional (contoh: { select: '*', 'id': 'eq.1' })
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${SUPABASE_URL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url, {
            method: 'GET',
            headers: supabaseHeaders
        });
        return this.handleResponse(response);
    },

    /**
     * Lakukan POST request (Insert single)
     * @param {string} endpoint - Nama tabel
     * @param {object} data - Payload data JSON
     */
    async post(endpoint, data) {
        const response = await fetch(`${SUPABASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: supabaseHeaders,
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Lakukan POST bulk request (Insert multiple records)
     * @param {string} endpoint - Nama tabel
     * @param {array} dataArray - Array dari data JSON
     */
    async postBulk(endpoint, dataArray) {
        const response = await fetch(`${SUPABASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(dataArray)
        });
        return this.handleResponse(response);
    },

    /**
     * Lakukan PATCH request (Update)
     * @param {string} endpoint - Nama tabel
     * @param {object} data - Payload data JSON yang akan diupdate
     * @param {object} params - Kondisi query opsional (contoh: { 'id': 'eq.1' })
     */
    async patch(endpoint, data, params = {}) {
        const url = new URL(`${SUPABASE_URL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url, {
            method: 'PATCH',
            headers: supabaseHeaders,
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    /**
     * Lakukan DELETE request
     * @param {string} endpoint - Nama tabel
     * @param {object} params - Kondisi query yang harus ada (contoh: { 'id': 'eq.1' })
     */
    async delete(endpoint, params = {}) {
        const url = new URL(`${SUPABASE_URL}/${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url, {
            method: 'DELETE',
            headers: supabaseHeaders
        });
        return this.handleResponse(response);
    },

    async handleResponse(response) {
        if (!response.ok) {
            let errorMsg = `API Request Failed: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorData.details || errorMsg;
            } catch (e) {
                // If it fails to parse JSON, it means it's likely a standard HTTP error.
            }
            console.error('[Supabase API Error]', errorMsg);
            throw new Error(errorMsg);
        }

        // Supabase DELETE atau update kosong biasanya mengembalikan 204 No Content
        if (response.status === 204) {
            return null;
        }

        return await response.json();
    }
};
