
export function onRequestGet(context) {
    const id = context.params.id

    if (!id) {
        return new Response('Not found', { status: 404 })
    }

    return Response.json({'id': id, 'there': 'you go'})
}