import { h, Component } from 'preact';

import UploadImageComponent from './upload-image-component';
import ComposeCaptionComponent from './compose-caption-component';
import HashtagsComponent from './hashtags-component';

import { me, upload } from '../helper';

export default class App extends Component {
  constructor() {
    super();

    this.state = { 
      username: me().username,
      caption: "",
      image: ""
    };
  }

  _handleUploadClick() {
    upload( this.state.image, this.state.caption );
  }

  _handleCancelClick() {
    location.reload();
  }

  onChange( state ) {
    this.setState( state );
  }

  render() {
    return (
      <div id="upload">
        
        <div class="header">
          <h1>Instaploader of {this.state.username}</h1>
        </div>

        <div class="content">
          <div class="column">
            <UploadImageComponent onChange={this.onChange.bind(this)} />
          </div>
          <div class="column">
            <ComposeCaptionComponent onChange={this.onChange.bind(this)} />
            <HashtagsComponent />
          </div>
        </div>

        <div class="submit">
          <button
            class="primary-btn"
            onClick={this._handleUploadClick.bind(this)}
          >
            Upload
          </button>

          <button
            class="secondary-btn"
            onClick={this._handleCancelClick.bind(this)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
}
