import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header from the request
    const authorization = request.headers.get('authorization');
    
    if (!authorization) {
      return NextResponse.json(
        { success: false, error: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { code, language, roomId } = body;

    // Validate required fields
    if (!code || !language || !roomId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: code, language, roomId' },
        { status: 400 }
      );
    }

    // Forward the request to the backend
    // Use NEXT_PUBLIC_BACKEND_URL (available in Next.js API routes)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://codemitrabackend.onrender.com';
    
    console.log(`[API] Proxying code execution to: ${backendUrl}/api/code/execute`);
    console.log(`[API] Request body:`, { code: code?.substring(0, 50) + '...', language, roomId });
    
    const response = await fetch(`${backendUrl}/api/code/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: JSON.stringify({ code, language, roomId }),
    });

    console.log(`[API] Backend response status: ${response.status}`);
    
    // Handle non-OK responses
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON, get text
        const text = await response.text();
        console.error(`[API] Backend returned non-JSON error:`, text);
        return NextResponse.json(
          { 
            success: false, 
            error: `Backend error: ${response.status} ${response.statusText}`,
            details: text.substring(0, 200)
          },
          { status: response.status }
        );
      }
      
      console.error(`[API] Backend error response:`, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    // Parse successful response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error(`[API] Failed to parse backend response:`, e);
      return NextResponse.json(
        { success: false, error: 'Invalid response from backend' },
        { status: 500 }
      );
    }

    // Return the response from the backend
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('Code execution proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Code execution failed' },
      { status: 500 }
    );
  }
}
