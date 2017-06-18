'use strict';

var snootubeInstance;

class SnooTubeMaterial {
  constructor() {
    this.redditAccessor = new RedditLoader();
    this.removeExistingComments(this.showLoadingScreen);
    this.findPostsForVideo( YoutubeData.getVideoId() );
  }

  removeExistingComments(cb) { 
    let observer = new MutationObserver((mutations) => {
      if( document.getElementById('comments') ) {
        document.getElementById('comments').remove();
        observer.disconnect();
        if( typeof(cb) === 'function' ) {
          cb();
        }
      }
    });
    observer.observe(document.querySelector('body'), {childList: true, subtree: true});
  }

  showLoadingScreen() {
    let loader = document.createElement('div');
    loader.className = 'snoo-loading style-scope ytd-watch';
    loader.innerText ='Loading a thing';
    document.getElementById('main').appendChild( loader );
  }

  findPostsForVideo( vidId ) {
    let query = `(url:${vidId}) (site:youtube.com OR site:youtu.be)`;
  }
}

class SnooTube_Old {
  constructor() {
    console.log("Not material Youtube");
  }
}

class RedditLoader {

}

class YoutubeData {
  static isVideoPage() {
    return window.location.pathname.match('watch');
  }

  static isMaterialYoutube() {
    return document.querySelector('#polymer-app') !== null;
  }

  static getVideoId() {
    let queryString = window.location.search.substr(1);
    let requestObjects = queryString.split('&');
    for (let i = 0, len = requestObjects.length; i < len; i += 1) {
        let obj = requestObjects[i].split('=');
        if (obj[0] === "v") {
            return obj[1];
        }
    }
  }
}

function init() {
  console.log("SnooTube initialized!");

  if( YoutubeData.isVideoPage() ) {
    console.log("Yes, is video page");

    if( YoutubeData.isMaterialYoutube() ) {
      snootubeInstance = new SnooTubeMaterial();
    } else {
      snootubeInstance = new SnooTube_Old();
    }
  }
}

if( document.readyState === "complete" || document.readyState === "interactive" ) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, false);
}