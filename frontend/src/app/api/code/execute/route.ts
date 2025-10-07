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
    // In Docker, use the service name; locally, use localhost
    const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';
    const response = await fetch(`${backendUrl}/api/code/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: JSON.stringify({ code, language, roomId }),
    });

    const data = await response.json();

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
