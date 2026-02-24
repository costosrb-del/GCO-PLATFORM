import asyncio
from sse_starlette.sse import EventSourceResponse

async def test():
    async def gen():
        yield 'string only'
        yield {'data': 'dict test'}
    resp = EventSourceResponse(gen())
    async for chunk in resp.body_iterator:
        print(repr(chunk))

asyncio.run(test())
