exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
        },
        body: JSON.stringify({
            message: 'Hello from sample-lambda-1!',
            timestamp: new Date().toISOString(),
            requestId: event.requestContext?.requestId || 'unknown'
        })
    };
    
    return response;
};