import { h, Component } from 'preact';

const PLACEHOLDER = 'images/placeholder.png';

export default class UploadImageComponent extends Component {
  constructor() {
    super();
    this.state = {
      file: '',
      imagePreviewSrc: PLACEHOLDER
    };
  }

  _handleImageChange( e ) {
    let reader = new FileReader();
    let file = e.target.files[0] || '';

    // clicking on Cancel -> restore placeholder
    if ( !file ) {
      this.setState({
        imagePreviewSrc: PLACEHOLDER
      });
      return;
    }

    reader.onloadend = () => {
      this.setState({
        file: file,
        imagePreviewSrc: reader.result
      });
    };
    reader.readAsDataURL(file);

    this.props.onChange( {image: file.path} );
  }

  render() {
    return (
      <div class="upload-image-component">
        <label class="note" for="upload-file">Image (?<span class="note-description"> : only jpg format is supported</span>)</label>
        
        <div class="image">
          <img id="image-placeholder" src={this.state.imagePreviewSrc} />
        </div>

        <input  
          id="upload-file"
          type="file"
          name="upload-file"
          accept=".jpg"
          onChange={this._handleImageChange.bind(this)}
        />
      </div>
    );
  }
}
