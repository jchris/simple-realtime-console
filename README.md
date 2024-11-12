# Simple Realtime Console

https://github.com/openai/openai-realtime-console but it doesnt suck. simplest possible frontend only VAD server implementation, because the original was way too bloated.

see diff


![image](https://github.com/user-attachments/assets/695e0dae-0a14-4128-98b3-faf1b121e23c)


i've also suppressed all the less useful event spam into the console and made the transcripts log nicely

![image](https://github.com/user-attachments/assets/5d259f29-dee7-4e10-98b8-850248450e21)

i've also fixed the memory injection so it starts off with a little memory.


# Starting the console

This is a React project created using `create-react-app` that is bundled via Webpack.
Install it by extracting the contents of this package and using;

```shell
$ npm i
```

Start your server with:

```shell
$ npm start
```

It should be available via `localhost:3000`.


# Using the console

The console requires an OpenAI API key (**user key** or **project key**) that has access to the
Realtime API. You'll be prompted on startup to enter it. It will be saved via `localStorage` and can be
changed at any time from the UI.

To start a session you'll need to **connect**. This will require microphone access.
We onlyhave **vad** (Voice Activity Detection)
conversation mode here, and switch between them at any time.

There is only one function enabled;

- `set_memory`: You can ask the model to remember information for you, and it will store it in
  a JSON blob on the left.

You can freely interrupt the model at any time in push-to-talk or VAD mode.

