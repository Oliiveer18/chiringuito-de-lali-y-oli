/** Respuestas simuladas para tests y desarrollo sin créditos (TRIPO_MOCK=1). */
export const MOCK_TASK_ID = 'mock-task-00000000-0000-4000-8000-000000000001';

const GLB_MAGIC = Buffer.from([0x67, 0x6c, 0x54, 0x46]); // glTF

export function mockGlbBuffer() {
  return Buffer.concat([
    GLB_MAGIC,
    Buffer.from([0x02, 0x00, 0x00, 0x00]),
    Buffer.alloc(8),
  ]);
}

export function handleMockRoute(method, pathname) {
  if (method === 'GET' && pathname === '/api/tripo/config') {
    return { status: 200, json: { configured: true, mock: true } };
  }
  if (method === 'GET' && pathname === '/api/tripo/balance') {
    return {
      status: 200,
      json: { code: 0, data: { balance: 9999, frozen: 0 }, mock: true },
    };
  }
  if (method === 'GET' && pathname === '/api/tripo/usage') {
    return { status: 200, json: { code: 0, data: [], mock: true } };
  }
  if (method === 'POST' && pathname === '/api/tripo/generate') {
    return {
      status: 200,
      json: { code: 0, data: { task_id: MOCK_TASK_ID }, mock: true },
    };
  }
  const taskMatch = pathname.match(/^\/api\/tripo\/tasks\/([^/]+)$/);
  if (method === 'GET' && taskMatch) {
    return {
      status: 200,
      json: {
        code: 0,
        data: {
          task_id: taskMatch[1],
          type: 'text_to_model',
          status: 'success',
          progress: 100,
          output: { model_url: 'mock://glb' },
        },
        mock: true,
      },
    };
  }
  const dlMatch = pathname.match(/^\/api\/tripo\/download\/([^/]+)$/);
  if (method === 'GET' && dlMatch) {
    return { status: 200, binary: mockGlbBuffer(), filename: `${dlMatch[1]}.glb` };
  }
  return null;
}
