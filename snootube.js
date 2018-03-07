'use strict';

var snootubeInstance;

class SnooTubeMaterial {
  constructor() {
    let self = this;
    self.redditAccessor = new RedditLoader(this);

    window.addEventListener('message', (msg) => {
      if( msg.data.type === 'RETRY_LOAD' ) {
        self.findPostsForVideo( YoutubeData.getVideoId() );
      }
    })
    self.removeExistingComments(() => {
      self.findPostsForVideo( YoutubeData.getVideoId() );
    });
  }

  removeExistingComments(cb) {
    let observer = new MutationObserver((mutations) => {
      if( document.getElementById('comments') ) {
        let ytComments = document.getElementById('comments');
        let newComments = document.createElement('div');
        newComments.id = 'comments';
        newComments.className = 'ytd-watch snootube-container';
        ytComments.parentNode.replaceChild(newComments, ytComments);
        observer.disconnect();
        if( typeof(cb) === 'function' ) {
          cb();
        }
      }
    });
    observer.observe(document.querySelector('body'), {childList: true, subtree: true});
  }

  showLoadingScreen() {
    if( !this.loadingDiv ) {
      let loadingDiv = document.createElement('div'),
          loader = document.createElement('div');
      loadingDiv.id = 'comments';
      loadingDiv.className = 'style-scope ytd-watch';
      loader.className = 'snoo-loader';
      loadingDiv.appendChild( loader );
      this.loadingDiv = loadingDiv;
    }
    document.getElementById('main').appendChild( this.loadingDiv );
  }

  hideLoadingScreen() {
    document.getElementById('main').removeChild( this.loadingDiv );
  }

  showNoResults() {
    let nrContainer = document.createElement( 'div' );
    nrContainer.id = 'snooNoResultsFound';
    nrContainer.className = 'style-scope ytd-watch';
    nrContainer.innerHTML = `<h3>No results found for this URL</h3>`;

    let retryButton = document.createElement('button');
    retryButton.className = 'snoo-retry-button';
    retryButton.addEventListener( 'click', () => window.postMessage({ type: "RETRY_LOAD" }, '*') );
    nrContainer.appendChild( retryButton );
    document.getElementById('comments').parentNode.replaceChild(nrContainer, document.getElementById('comments'));

    this.hideLoadingScreen();
  }

  findPostsForVideo( vidId ) {
    this.showLoadingScreen();

    this.redditAccessor.searchForPosts( vidId );
  }

  showThreadResults( threadList ) {
    let tabContainer = document.createElement('div'),
        threadContainer = document.createElement('div');
    tabContainer.className = 'snoo-tabs';
    threadContainer.className = 'snoo-threads';

    document.getElementById('comments').appendChild( tabContainer )
    document.getElementById('comments').appendChild( threadContainer );

    threadList.sort((a,b) => a.score - b.score);
    threadList.forEach((item) => {
      if( item.data.url.match(YoutubeData.getVideoId()) ) {
        ContentRenderer.renderTab( item.data ).then((result) => {
          console.log(result);
          tabContainer.innerHTML += result;
        });
      }
    });

    this.hideLoadingScreen();
    tabContainer.classList.add('visible');
  }
}

class SnooTube_Old {
  constructor() {
    console.log("Not material Youtube");
  }
}

class ContentRenderer {
  static _loadTemplate( templateName ) {
    return fetch(chrome.extension.getURL(`/templates/${templateName}.html`), {mode: 'cors'})
      .then(res => res.text())
      .then(body => body);
  }

  static renderTab( redditResult ) {
    return this._loadTemplate( 'snootubeTabTemplate' ).then( (template) => {
      console.log('Got template');
      console.log(template);
      console.log(redditResult);
      return mustache(template, redditResult);
    });
  }
}

class RedditLoader {
  constructor( snootubeInstance ) {
    this.snootube = snootubeInstance;
  }

  searchForPosts( vidId ) {
    let query = `(url:${vidId}) (site:youtube.com OR site:youtu.be)`;

    fetch( 'https://api.reddit.com/search.json?q=' + query, {mode: 'cors'} ).then((result) => {
      result.json().then((obj) => {
        if( obj && obj.kind === 'Listing' && obj.data.children.length > 0 ) {
          this.snootube.showThreadResults( obj.data.children );
        } else {
          this.snootube.showNoResults();
        }
      });
    });
  }
}

class YoutubeData {
  static isVideoPage() {
    return window.location.pathname.match('watch');
  }

  static isMaterialYoutube() {
    return document.querySelector('ytd-app') !== null;
  }

  static getVideoId() {
    if( this.vidId ) return this.vidId;
    let queryString = window.location.search.substr(1);
    let requestObjects = queryString.split('&');
    for (let i = 0, len = requestObjects.length; i < len; i += 1) {
        let obj = requestObjects[i].split('=');
        if (obj[0] === "v") {
            this.vidId = obj[1];
            return obj[1];
        }
    }
  }
}

function init() {
  console.log("SnooTube initialized!");

  if( typeof mustache !== 'undefined' ) {
    console.log('Mustache defined');
    console.log(mustache);
    console.log(mustache('<div>{{test}}</div>', {test: 'hi'}));
  }

  if( YoutubeData.isVideoPage() ) {
    console.log("Yes, is video page");

    if( YoutubeData.isMaterialYoutube() ) {
      snootubeInstance = new SnooTubeMaterial();
    } else {
      snootubeInstance = new SnooTube_Old();
    }
  } else {
    console.log('is not video page');
  }
}

if( document.readyState === "complete" || document.readyState === "interactive" ) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, false);
}