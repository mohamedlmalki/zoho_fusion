// --- FILE: apps/ops/server/qntrl-handler.js ---
const { makeApiCall, parseError, createJobId } = require('./utils');

let activeJobs = {};

/**
 * Helper: Fetches the form layout and builds a map of API Name -> Field Label
 */
async function getFieldMap(activeProfile, formId) {
    try {
        const orgId = activeProfile.qntrl?.orgId;
        if (!orgId) return {};

        // Reuse makeApiCall (read-only, so no log loop)
        const response = await makeApiCall(
            'get',
            `/blueprint/api/${orgId}/layout/${formId}`,
            null,
            activeProfile,
            'qntrl'
        );
        
        const map = {};
        const sections = response.data?.section_details || [];
        const allFields = sections.flatMap(section => section.sectionfieldmap_details || []);
        
        console.log(`[QNTRL DEBUG] Scanning ${allFields.length} fields in layout...`);

        allFields.forEach(field => {
            const details = field.customfield_details?.[0];
            const api_name = details?.column_name || field.column_name || field.api_name; 
            const label = field.field_name;
            
            if (api_name && label) {
                map[api_name] = label;
                map[api_name.toLowerCase()] = label; 
            }
        });
        
        map['title'] = 'Title';
        return map;
    } catch (e) {
        console.error("[QNTRL] Failed to fetch field map for logging:", e.message);
        return {}; 
    }
}

/**
 * Helper function to make the API call for creating a single Qntrl card.
 */
async function createCardApiCall(cardData, formId, activeProfile, orgId, fieldMap) {
    try {
        const payload = new URLSearchParams();
        
        for (const key in cardData) {
            if (cardData[key] !== null && cardData[key] !== undefined) {
                 payload.append(key, cardData[key]);
            }
        }
        payload.append('layout_id', formId);

        const apiResponse = await makeApiCall(
            'post',
            `/blueprint/api/${orgId}/job`,
            payload,
            activeProfile,
            'qntrl',
            {}, 
            fieldMap 
        );

        const cardId = apiResponse.data?.id || 'Unknown';
        return {
            success: true,
            details: cardId,
            fullResponse: apiResponse.data,
        };
    } catch (error) {
        const { message, fullResponse } = parseError(error);
        let detailedError = message;
        if (fullResponse?.errors) {
            const missingParam = Object.keys(fullResponse.errors)[0];
            detailedError = `Missing required parameter: ${missingParam}`;
        }

        return {
            success: false,
            error: detailedError,
            fullResponse: fullResponse,
        };
    }
}

const handler = {
    setActiveJobs: (jobs) => {
        activeJobs = jobs;
    },

    handleGetForms: async (socket, data) => {
        try {
            const { activeProfile } = data;
            const orgId = activeProfile.qntrl?.orgId;
            if (!orgId) throw new Error("Qntrl Organization ID is not configured.");

            const response = await makeApiCall(
                'get',
                `/blueprint/api/${orgId}/layout`, 
                null,
                activeProfile,
                'qntrl'
            );
            
            const forms = response.data?.layouts || response.data || [];
            socket.emit('qntrlFormsResult', { success: true, forms: forms });
        } catch (error) {
            const { message } = parseError(error);
            socket.emit('qntrlFormsResult', { success: false, error: message });
        }
    },

    handleGetFormDetails: async (socket, data) => {
        try {
            const { activeProfile, formId } = data;
            const orgId = activeProfile.qntrl?.orgId;
            if (!orgId) throw new Error("Qntrl Organization ID is not configured.");

            const response = await makeApiCall(
                'get',
                `/blueprint/api/${orgId}/layout/${formId}`, 
                null,
                activeProfile,
                'qntrl'
            );
            
            const sections = response.data?.section_details || [];
            const allFields = sections.flatMap(section => section.sectionfieldmap_details || []);

            const filteredFields = allFields.filter(field => {
                if (field.field_name === 'Title') return true;
                const details = field.customfield_details?.[0];
                if (details && details.entity_type_value === 'CUSTOMIZED') return true;
                return false;
            });

            const components = filteredFields.map(field => {
                const details = field.customfield_details?.[0];
                const api_name = details?.column_name || field.column_name;
                
                return {
                    field_label: field.field_name,
                    field_api_name: api_name, 
                    field_type: field.field_type,
                    is_mandatory: field.is_mandatory
                };
            });

            socket.emit('qntrlFormDetailsResult', { success: true, components: components });
        } catch (error) {
            const { message } = parseError(error);
            socket.emit('qntrlFormDetailsResult', { success: false, error: message });
        }
    },

    handleCreateCard: async (socket, data) => {
        try {
            const { activeProfile, cardData, formId } = data;
            const orgId = activeProfile.qntrl?.orgId;
            if (!orgId) throw new Error("Qntrl Organization ID is not configured.");

            const fieldMap = await getFieldMap(activeProfile, formId);
            const result = await createCardApiCall(cardData, formId, activeProfile, orgId, fieldMap);
            socket.emit('qntrlSingleCardResult', result);
        } catch (error) {
            const { message } = parseError(error);
            socket.emit('qntrlSingleCardResult', { success: false, error: message });
        }
    },

    handleStartBulkCreateCards: async (socket, data) => {
        const { selectedProfileName, activeProfile, totalToProcess } = data;
        const { selectedFormId, bulkPrimaryField, bulkPrimaryValues, bulkDefaultData, bulkDelay, stopAfterFailures = 4 } = data.formData;
        const delay = (Number(bulkDelay) || 1) * 1000;
        const jobType = 'qntrl';
        const jobId = createJobId(socket.id, selectedProfileName, jobType);

        console.log(`[INFO] Starting bulk Qntrl card creation for ${selectedProfileName}. Job ID: ${jobId}`);
        activeJobs[jobId] = { status: 'running', total: totalToProcess, processed: 0 };
        
        let consecutiveFailures = 0; // 🟢 TRACK FAILURES

        try {
            const orgId = activeProfile.qntrl?.orgId;
            if (!orgId) throw new Error("Qntrl Organization ID is not configured.");
            
            if (!selectedFormId || !bulkPrimaryField || !bulkPrimaryValues) {
                throw new Error("Form, Primary Field, and Primary Values are required.");
            }

            const fieldMap = await getFieldMap(activeProfile, selectedFormId);
            const primaryValues = bulkPrimaryValues.split('\n').filter(v => v.trim() !== '');

            for (const primaryValue of primaryValues) {
                if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;

                // 🟢 HANDLE PAUSE / RESUME LOGIC
                if (activeJobs[jobId].status === 'paused') {
                    consecutiveFailures = 0; 
                }
                while (activeJobs[jobId]?.status === 'paused') {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                if (!activeJobs[jobId] || activeJobs[jobId].status === 'ended') break;

                const cardData = { ...bulkDefaultData };
                cardData[bulkPrimaryField] = primaryValue.trim();
                
                if (bulkPrimaryField !== 'title' && !cardData['title']) {
                    cardData['title'] = `Card ${primaryValue.trim()}`;
                }

                const result = await createCardApiCall(cardData, selectedFormId, activeProfile, orgId, fieldMap);

                // 🟢 INCREMENT OR RESET FAILURES
                if (result.success) {
                    consecutiveFailures = 0;
                } else {
                    consecutiveFailures++;
                }

                socket.emit('qntrlResult', {
                    ...result,
                    primaryValue: primaryValue.trim(),
                    profileName: selectedProfileName
                });

                // 🟢 AUTO-PAUSE IF LIMIT REACHED
                if (!result.success && stopAfterFailures > 0 && consecutiveFailures >= stopAfterFailures) {
                    activeJobs[jobId].status = 'paused';
                    socket.emit('jobPaused', {
                        profileName: selectedProfileName,
                        reason: `Auto-paused after ${consecutiveFailures} consecutive failures.`,
                        jobType: 'qntrl'
                    });
                }

                activeJobs[jobId].processed++;
                await new Promise(resolve => setTimeout(resolve, delay));
            }

        } catch (error) {
            console.error(`[ERROR] Job ${jobId}:`, error);
            const { message } = parseError(error);
            socket.emit('bulkError', { message, profileName: selectedProfileName, jobType });
        } finally {
            if (activeJobs[jobId]) {
                const finalStatus = activeJobs[jobId].status;
                if (finalStatus === 'ended') {
                    socket.emit('bulkEnded', { profileName: selectedProfileName, jobType: 'qntrl' });
                } else {
                    socket.emit('bulkComplete', { profileName: selectedProfileName, jobType: 'qntrl' });
                }
                delete activeJobs[jobId];
            }
            console.log(`[INFO] Job ${jobId} finished.`);
        }
    },
};

module.exports = handler;